import esbuild from 'esbuild'
import path from 'path'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

/**
 * Recursively get all .ts files in a directory.
 * @param dir - The directory to search.
 * @returns An array of file paths.
 */
async function getAllFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory() ? getAllFiles(res) : res.endsWith('.ts') ? [res] : []
    }),
  )
  return Array.prototype.concat(...files)
}
const execAsync = promisify(exec)
const entry = 'src/index.ts'
const outDir = 'lib'
const external = ['react', 'react-native', 'use-sync-external-store/shim/with-selector']
// Ensure output directories
await fs.mkdir(path.join(outDir, 'cjs'), { recursive: true })
await fs.mkdir(path.join(outDir, 'esm'), { recursive: true })
await fs.mkdir(path.join(outDir, 'src'), { recursive: true })

// Copy source files for react-native compatibility
await fs.cp('src', path.join(outDir, 'src'), { recursive: true })

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
  entryPoints: await getAllFiles('src'),
  bundle: false,
  format: 'esm',
  outdir: path.join(outDir, 'esm'),
  minify: true,
  preserveSymlinks: true,
  // external,
})

// TypeScript types generation using tsconfig.types.json
await execAsync('bunx tsc --project tsconfig.types.json --module ESNext --outDir lib/types --emitDeclarationOnly true')
import packageJson from './package.json'
// @ts-ignore
delete packageJson.scripts
// @ts-ignore
delete packageJson.devDependencies
// Copy package.json and README.md
await fs.writeFile(path.join(outDir, 'package.json'), JSON.stringify(packageJson, null, 2))

// Copy README.md
await fs.copyFile('README.md', path.join(outDir, 'README.md'))

// Copy LICENSE
await fs.copyFile('LICENSE', path.join(outDir, 'LICENSE'))

// Check also .npmrc if exist, if so copy it
try {
  await fs.copyFile('.npmrc', path.join(outDir, '.npmrc'))
} catch {
  console.log('No .npmrc file found')
}
