import { useNavigate } from 'react-router-dom'
import { useCallback } from 'react'

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => unknown
}

/**
 * Hook wrapping the View Transitions API for smooth page transitions.
 * Falls back to regular navigation if the API is not supported —
 * 미지원 브라우저는 App의 .page-enter 폴백 애니메이션이 전환을 담당한다.
 */
export function useViewTransition() {
  const navigate = useNavigate()

  const navigateWithTransition = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      const doc = document as DocumentWithViewTransition
      if (doc.startViewTransition) {
        doc.startViewTransition(() => {
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
