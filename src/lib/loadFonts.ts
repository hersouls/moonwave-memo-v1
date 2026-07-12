/**
 * Self-hosted default font (§4.8 폰트 로컬 번들).
 *
 * Pretendard is the app's default UI font. It used to load from a CDN, which breaks
 * offline — fatal for the packaged Electron desktop app. Here we bundle the Pretendard
 * *variable* woff2 (a single ~2MB file covering all weights, smaller than the CDN full
 * static set) via Vite and register it under the `Pretendard` family the app already
 * references. Works identically on the web and under the Electron app:// protocol.
 *
 * The optional Korean display fonts (NanumSquare family, MaruBuri) remain CDN-loaded
 * and degrade gracefully to system fonts offline — bundling all of them would add
 * ~15MB+ to the app for fonts most users never select.
 */
import pretendardWoff2 from 'pretendard/dist/web/variable/woff2/PretendardVariable.woff2?url'

export function loadBundledFonts(): void {
  if (typeof document === 'undefined') return
  const style = document.createElement('style')
  style.setAttribute('data-bundled-font', 'pretendard')
  style.textContent = `@font-face {
  font-family: 'Pretendard';
  font-weight: 45 920;
  font-style: normal;
  font-display: swap;
  src: url('${pretendardWoff2}') format('woff2-variations');
}`
  document.head.appendChild(style)
}
