import type { CapacitorConfig } from '@capacitor/cli'

// Phase 3: Android (Capacitor) wrapper of the existing Vite renderer.
// The native project (android/) is generated with `npx cap add android` and is
// gitignored — see docs/CAPACITOR_BUILD.md.
const config: CapacitorConfig = {
  appId: 'kr.moonwave.memo',
  appName: 'Moonwave Memo',
  webDir: 'dist',
  android: {
    // Allow http during local dev against the Vite server; production uses the bundle.
    allowMixedContent: false,
  },
}

export default config
