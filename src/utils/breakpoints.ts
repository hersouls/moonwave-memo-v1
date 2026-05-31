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

// Pre-built media query strings for JS matchMedia calls.
// Three-tier model: mobile (≤767, touch-first) · tablet (768–1023) · desktop (≥1024).
export const MEDIA = {
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  tabletOnly: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,
  wideDesktop: `(min-width: ${BREAKPOINTS.xl}px)`,
  tablet: `(min-width: ${BREAKPOINTS.md}px)`,
  fold: `(max-width: ${BREAKPOINTS.fold}px) and (min-height: 600px)`,
} as const
