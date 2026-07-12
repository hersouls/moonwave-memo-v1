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
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'electron/out/preload.cjs' })

console.log('✓ electron main/preload → electron/out/')
