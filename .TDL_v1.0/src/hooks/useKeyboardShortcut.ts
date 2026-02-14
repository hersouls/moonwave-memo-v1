import { useEffect, useCallback } from 'react'

interface ShortcutOptions {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  preventDefault?: boolean
}

export function useKeyboardShortcut(
  shortcut: ShortcutOptions | ShortcutOptions[],
  callback: () => void,
  deps: React.DependencyList = []
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut]

      for (const s of shortcuts) {
        const keyMatch = event.key.toLowerCase() === s.key.toLowerCase()
        const ctrlMatch = s.ctrl ? event.ctrlKey || event.metaKey : true
        const metaMatch = s.meta ? event.metaKey : true
        const shiftMatch = s.shift ? event.shiftKey : !event.shiftKey
        const altMatch = s.alt ? event.altKey : !event.altKey

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          if (s.preventDefault !== false) {
            event.preventDefault()
          }
          callback()
          break
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, ...deps]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
