import { useNavigate } from 'react-router-dom'
import { useCallback } from 'react'

/**
 * Hook wrapping the View Transitions API for smooth page transitions.
 * Falls back to regular navigation if the API is not supported.
 */
export function useViewTransition() {
  const navigate = useNavigate()

  const navigateWithTransition = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if ('startViewTransition' in document) {
        (document as any).startViewTransition(() => {
          navigate(path, options)
        })
      } else {
        navigate(path, options)
      }
    },
    [navigate]
  )

  return { navigateWithTransition }
}
