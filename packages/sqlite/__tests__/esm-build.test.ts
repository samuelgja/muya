import { describe, it, expect, beforeAll } from 'bun:test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const packageRoot = path.resolve(import.meta.dir, '..')
const distributionRoot = path.join(packageRoot, 'dist')
const esmEntry = path.join(distributionRoot, 'esm', 'index.js')

const ALLOWED_EXT = /\.(?:js|mjs|cjs|json|node)$/
// eslint-disable-next-line sonarjs/slow-regex -- bounded scan over our own build output, never user input
const RELATIVE_SPEC = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g

/**
 * Recursively collect files under a directory whose name ends with the given suffix.
 * @param directory Directory to walk.
 * @param suffix File name suffix to match (for example `.js`).
 * @returns Absolute paths of the matching files.
 */
function collect(directory: string, suffix: string): string[] {
  if (!fs.existsSync(directory)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) out.push(...collect(full, suffix))
    else if (entry.name.endsWith(suffix)) out.push(full)
  }
  return out
}

/**
 * Find relative import/export specifiers that lack an explicit file extension.
 * @param content Source of a built `.js` or `.d.ts` file.
 * @returns The offending extensionless specifiers.
 */
function extensionlessRelativeSpecs(content: string): string[] {
  const bad: string[] = []
  for (const match of content.matchAll(RELATIVE_SPEC)) {
    const [, spec] = match
    if (!ALLOWED_EXT.test(spec)) bad.push(spec)
  }
  return bad
}

describe('sqlite esm build packaging', () => {
  beforeAll(() => {
    // Build core first so the `muya` import resolves to a freshly packaged ESM entry, then sqlite.
    const core = Bun.spawnSync(['bun', 'run', 'build.ts'], {
      cwd: path.resolve(packageRoot, '..', 'core'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (core.exitCode !== 0) throw new Error(`core build failed: ${core.stderr.toString()}`)
    const built = Bun.spawnSync(['bun', 'run', 'build.ts'], { cwd: packageRoot, stdout: 'pipe', stderr: 'pipe' })
    if (built.exitCode !== 0) throw new Error(`sqlite build failed: ${built.stderr.toString()}`)
  }, 120_000)

  it('emits no extensionless relative imports in built JS', () => {
    const offenders = collect(distributionRoot, '.js').flatMap((file) =>
      extensionlessRelativeSpecs(fs.readFileSync(file, 'utf8')).map(
        (spec) => `${path.relative(distributionRoot, file)} -> ${spec}`,
      ),
    )
    expect(offenders).toEqual([])
  })

  it('emits no extensionless relative imports in built type declarations', () => {
    const offenders = collect(distributionRoot, '.d.ts').flatMap((file) =>
      extensionlessRelativeSpecs(fs.readFileSync(file, 'utf8')).map(
        (spec) => `${path.relative(distributionRoot, file)} -> ${spec}`,
      ),
    )
    expect(offenders).toEqual([])
  })

  it('marks dist/esm as ESM and dist/cjs as CommonJS via package.json', () => {
    const esmPackage = JSON.parse(fs.readFileSync(path.join(distributionRoot, 'esm', 'package.json'), 'utf8'))
    const cjsPackage = JSON.parse(fs.readFileSync(path.join(distributionRoot, 'cjs', 'package.json'), 'utf8'))
    expect(esmPackage.type).toBe('module')
    expect(cjsPackage.type).toBe('commonjs')
  })

  it('imports under native Node ESM (resolving the muya peer) and exposes useSqliteValue', () => {
    const probe = path.join(os.tmpdir(), 'muya-sqlite-ssr-probe.mjs')
    fs.writeFileSync(
      probe,
      [
        `import * as m from ${JSON.stringify(esmEntry)}`,
        `if (typeof m.useSqliteValue !== 'function') { console.error('NO_EXPORT'); process.exit(3) }`,
        `console.log('IMPORT_OK')`,
      ].join('\n'),
    )
    const run = Bun.spawnSync(['node', probe], { cwd: packageRoot, stdout: 'pipe', stderr: 'pipe' })
    expect(run.stdout.toString()).toContain('IMPORT_OK')
    expect(run.stderr.toString()).not.toContain('MODULE_TYPELESS_PACKAGE_JSON')
    expect(run.exitCode).toBe(0)
  })
})
