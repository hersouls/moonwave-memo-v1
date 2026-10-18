import { useEffect, useState } from 'react'

/**
 * 화면(창)이 `min`px 이상으로 넓은지 알려 줘요. 편집기가 놓인 자리의 너비가 아니라 화면을 봐요:
 * 정보 서랍이 열리면 서랍이 편집기를 옆으로 밀어서 자리가 줄어드는데, 그 너비를 따라 서랍을 여닫으면 열렸다 닫혔다 해요.
 */
export function useViewportMin(min: number): boolean {
  const query = `(min-width: ${min}px)`
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const read = () => setWide(mql.matches)
    read()
    mql.addEventListener('change', read)
    return () => mql.removeEventListener('change', read)
  }, [query])
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
