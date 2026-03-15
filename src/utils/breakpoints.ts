// Canonical breakpoint values (px) — single source of truth
export const BREAKPOINTS = {
  xs: 360,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1920,
  fold: 420,
} as const

// Pre-built media query strings for JS matchMedia calls
export const MEDIA = {
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,
  wideDesktop: `(min-width: ${BREAKPOINTS.xl}px)`,
  tablet: `(min-width: ${BREAKPOINTS.md}px)`,
  fold: `(max-width: ${BREAKPOINTS.fold}px) and (min-height: 600px)`,
} as const
