// Bundle the Electron main + preload (TypeScript) to CommonJS with esbuild.
// esbuild handles TS → JS fast; type safety is checked separately via
// `tsc --noEmit -p tsconfig.electron.json`.
import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20', // Electron 43 ships Node 20+
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
}

await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'electron/out/main.cjs' })
const preload = await build({
  ...common,
  entryPoints: ['electron/preload.ts'],
  outfile: 'electron/out/preload.cjs',
  metafile: true,
})

// The preload runs sandboxed (webPreferences.sandbox: true), where require() only knows
// 'electron'. Any other runtime import — a node builtin such as node:path, or a package —
// would throw at load time and silently remove window.electronBridge. Fail the build instead.
const badImports = Object.values(preload.metafile.outputs)
  .flatMap((output) => output.imports)
  .filter((imp) => imp.external && imp.path !== 'electron')
  .map((imp) => imp.path)
if (badImports.length > 0) {
  console.error(`✗ sandboxed preload must only require 'electron', found: ${[...new Set(badImports)].join(', ')}`)
  process.exit(1)
}

console.log('✓ electron main/preload → electron/out/')
