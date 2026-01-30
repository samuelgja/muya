import esbuild from 'esbuild'
import path from 'path'
import fs from 'fs/promises'
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

// ESM build (files as they are)
await esbuild.build({
  entryPoints: files,
  bundle: false,
  format: 'esm',
  outdir: path.join(outDir, 'esm'),
  minify: true,
  preserveSymlinks: true,
})

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

console.log('Build complete: dist/')
