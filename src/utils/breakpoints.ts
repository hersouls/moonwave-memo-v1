// 화면이 바뀌는 너비는 Moonwave UX가 정한 넷뿐이에요: 380 · 600 · 900 · 1280
// (https://ux.moonwave.kr/foundations/spacing-layout#breakpoints). 다른 숫자를 더하지 않아요.
// 키트는 (max-width: 900px)처럼 쓰므로, 그 반대쪽 조건은 1px 위에서 시작해요.
export const BREAKPOINTS = {
  xs: 381,
  sm: 601,
  md: 901,
  lg: 901,
  xl: 1280,
  fold: 380,
} as const

// Pre-built media query strings for JS matchMedia calls.
// 두 단계예요: 좁은 화면(900px 이하, 하단 탭) · 넓은 화면(901px부터, 사이드바). 1280px부터는 목록과 편집기를 나란히 둬요.
export const MEDIA = {
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,
  wideDesktop: `(min-width: ${BREAKPOINTS.xl}px)`,
  tablet: `(min-width: ${BREAKPOINTS.md}px)`,
  fold: `(max-width: ${BREAKPOINTS.fold}px)`,
} as const
