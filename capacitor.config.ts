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
  plugins: {
    // 네이티브 Google Sign-In → 웹 SDK signInWithCredential 브리지 (authStore.login).
    // WebView에서는 Google이 popup/redirect를 차단(disallowed_useragent)하므로 필수.
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
}

export default config
