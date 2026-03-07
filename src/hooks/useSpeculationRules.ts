import { useEffect, useRef } from 'react'

export function useSpeculationRules(memoIds: number[]) {
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    // Feature detection
    if (
      typeof HTMLScriptElement === 'undefined' ||
      !HTMLScriptElement.supports?.('speculationrules')
    ) {
      return
    }

    // Remove previous rules
    if (scriptRef.current) {
      scriptRef.current.remove()
      scriptRef.current = null
    }

    if (memoIds.length === 0) return

    // Prerender top 5 visible memos
    const urls = memoIds.slice(0, 5).map((id) => `/memo/${id}`)

    const rules = {
      prerender: [
        {
          urls,
          eagerness: 'moderate',
        },
      ],
    }

    const script = document.createElement('script')
    script.type = 'speculationrules'
    script.textContent = JSON.stringify(rules)
    document.head.appendChild(script)
    scriptRef.current = script

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove()
        scriptRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoIds.join(',')])
}
