import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * 요소가 `min`px 이상으로 넓은지 알려 줘요. 화면이 아니라 그 요소가 놓인 자리의 너비를 봐요:
 * 편집기는 화면 전체에 놓일 때도, 목록 옆의 칸에 놓일 때도 있어서 화면 너비로는 알 수 없어요.
 * 너비는 Moonwave UX가 정한 넷(380 · 600 · 900 · 1280) 가운데에서 골라요.
 */
export function useMinWidth(ref: RefObject<HTMLElement | null>, min: number): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setWide(el.clientWidth >= min)
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, min])
  return wide
}

/** 값이 `delay`ms 동안 바뀌지 않았을 때의 값이에요. 글자를 칠 때마다 다시 계산하기에는 무거운 일에 써요. */
export function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}
