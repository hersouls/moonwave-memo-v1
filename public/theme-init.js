/* Pre-paint: apply the saved theme before the first frame, so a dark-theme device never flashes white.
   External file on purpose (CSP script-src 'self' — no inline scripts). Keep the key in step with src/stores/settingsStore.ts. */
(function () {
  try {
    var t = localStorage.getItem('memo-theme')
    var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } catch { /* storage blocked: the app sets the theme after load */ }
})()
