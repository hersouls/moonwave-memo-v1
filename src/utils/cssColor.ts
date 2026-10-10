/**
 * 토큰으로 적은 색(var(--mw-cat-2))을 브라우저가 계산한 값(rgb(…))으로 풀어요.
 * CSS가 닿지 않는 곳(WebGL 그래프, 그림으로 내보내기)에만 써요. 화면의 요소에는 var()를 그대로 줘요.
 */
export function resolveCssColor(value: string, fallback = 'gray'): string {
  if (typeof document === 'undefined' || !value.includes('var(')) return value || fallback
  const probe = document.createElement('span')
  probe.style.color = value
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  return computed || fallback
}
