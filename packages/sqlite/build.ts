import esbuild from 'esbuild'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Recursively get all .ts files in a directory, excluding test files.
 */
async function getAllFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name)
      if (dirent.isDirectory()) {
        if (dirent.name === '__tests__') return []
        return getAllFiles(res)
      }
      return res.endsWith('.ts') || res.endsWith('.tsx') ? [res] : []
    }),
  )
  return Array.prototype.concat(...files)
}

/**
 * Recursively get all .d.ts declaration files in a directory.
 */
async function getDeclarationFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name)
      if (dirent.isDirectory()) return getDeclarationFiles(res)
      return res.endsWith('.d.ts') ? [res] : []
    }),
  )
  return Array.prototype.concat(...files)
}

const HAS_EXTENSION = /\.(?:js|mjs|cjs|json|node)$/
const RELATIVE_MODULE_SPEC = /((?:from|import\s*\()\s*)(['"])(\.\.?\/[^'"]+)\2/g

/**
 * Rewrite extensionless relative import/export specifiers in a declaration file to explicit
 * `.js` (or `/index.js`) paths so Node's native ESM resolver and `moduleResolution: nodenext`
 * consumers can resolve them.
 */
function addDeclarationExtensions(code: string, fileDir: string): string {
  return code.replace(RELATIVE_MODULE_SPEC, (full, lead, quote, spec) => {
    if (HAS_EXTENSION.test(spec)) return full
    if (existsSync(path.resolve(fileDir, `${spec}.d.ts`))) return `${lead}${quote}${spec}.js${quote}`
    if (existsSync(path.resolve(fileDir, spec, 'index.d.ts'))) {
      return `${lead}${quote}${spec.replace(/\/$/, '')}/index.js${quote}`
    }
    return full
  })
}

/**
 * Add explicit extensions to every declaration file and drop per-directory `package.json`
 * markers so Node treats `dist/esm` as ESM and `dist/cjs` as CommonJS.
 */
async function finalizePackaging(outDirAbs: string): Promise<void> {
  const typesDir = path.join(outDirAbs, 'types')
  const declarations = await getDeclarationFiles(typesDir)
  await Promise.all(
    declarations.map(async (file) => {
      const code = await fs.readFile(file, 'utf8')
      const fixed = addDeclarationExtensions(code, path.dirname(file))
      if (fixed !== code) await fs.writeFile(file, fixed)
    }),
  )
  await fs.writeFile(path.join(outDirAbs, 'esm', 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`)
  await fs.writeFile(path.join(outDirAbs, 'cjs', 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)
}

const entryDir = 'src'
const entry = path.join(entryDir, 'index.ts')
const outDir = 'dist'
const external = ['react', 'react-native', 'muya']

// Clean output directory
await fs.rm(outDir, { recursive: true, force: true })

// Ensure output directories
await fs.mkdir(path.join(outDir, 'cjs'), { recursive: true })
await fs.mkdir(path.join(outDir, 'esm'), { recursive: true })
await fs.mkdir(path.join(outDir, 'types'), { recursive: true })

// Get all source files
const files = await getAllFiles(entryDir)

// CommonJS build (single file)
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'cjs',
  outfile: path.join(outDir, 'cjs/index.js'),
  minify: true,
  preserveSymlinks: true,
  external,
})

// ESM build (single bundled file so Node/strict-ESM resolvers don't need extension rewriting)
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  outfile: path.join(outDir, 'esm/index.js'),
  minify: true,
  preserveSymlinks: true,
  external,
})

// Reference the full source file list so esbuild still treats per-file includes as intentional
void files

// Create temporary node_modules/muya link for type generation
const nodeModulesDir = 'node_modules'
const muyaLink = path.join(nodeModulesDir, 'muya')
await fs.mkdir(nodeModulesDir, { recursive: true })
try {
  await fs.rm(muyaLink, { recursive: true, force: true })
} catch {
  // ignore
}
await fs.symlink(path.resolve('../core'), muyaLink, 'dir')

// TypeScript types generation
await execAsync('bunx tsc --project tsconfig.build.json')

// Clean up temporary link
await fs.rm(muyaLink, { recursive: true, force: true })

// Add explicit declaration extensions + per-directory module-type markers (ESM/CJS)
await finalizePackaging(path.resolve(outDir))

console.log('Build complete: dist/')
