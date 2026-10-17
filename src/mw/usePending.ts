/* Moonwave UX — usePending (버튼을 눌렀는데 결과가 바로 안 나올 때)
   규격: https://ux.moonwave.kr/patterns/long-wait */
import { useCallback, useEffect, useRef, useState } from 'react'

/** 기다리는 동안 언제 무엇을 보여 주는지(ms)예요. 값은 여기에만 있어요. */
export const PENDING = {
  /** 이 안에 끝나면 아무것도 더하지 않아요. 누른 버튼의 고리만 100ms 뒤에 붙어요. */
  press: 100,
  /** 이때부터 결과 자리에 진행 칸(`Pending`)이 나와요. */
  show: 1000,
  /** 이때부터 `12초째`와 `보통 10~25초`를 보여 줘요. */
  time: 3000,
  /** 이때부터 `다른 화면으로 가도 계속해요`를 알려요. */
  long: 30000,
  /** 이 시간이 지나면 응답이 없다고 말하고 다시 하게 해요. */
  giveUp: 120000,
} as const

export type PendingPhase = 'idle' | 'press' | 'working' | 'long' | 'giveup' | 'done' | 'error' | 'canceled'

export type PendingState = {
  phase: PendingPhase
  /** 버튼을 `aria-busy`로 둘지예요(press부터 giveup까지). */
  busy: boolean
  /** 진행 칸을 보일지예요(show부터). */
  showBlock: boolean
  /** `12초째`를 보일지예요(time부터). */
  showTime: boolean
  /** 걸린 초예요. */
  seconds: number
  error: string
}

/**
 * 오래 걸리는 일을 `run`으로 감싸요. 다시 눌러도 일을 두 번 시키지 않고, `cancel`로 멈춰요(AbortSignal을 넘겨요).
 *
 * ```tsx
 * const p = usePending()
 * <Button aria-busy={p.state.busy} onClick={() => p.run((signal) => api.draft(text, { signal }))}>
 *   {p.state.busy ? '초안을 쓰고 있어요' : '초안 쓰기'}
 * </Button>
 * <Pending pending={p} title="초안을 쓰고 있어요" step="자료를 읽는 중" typical="보통 10~25초" />
 * ```
 */
export function usePending() {
  const [state, setState] = useState<PendingState>({ phase: 'idle', busy: false, showBlock: false, showTime: false, seconds: 0, error: '' })
  const ctl = useRef<AbortController | null>(null)
  const started = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const stop = useCallback(() => { if (timer.current !== undefined) window.clearInterval(timer.current); timer.current = undefined }, [])
  useEffect(() => () => { stop(); ctl.current?.abort() }, [stop])

  const tick = useCallback(() => {
    const ms = Date.now() - started.current
    const phase: PendingPhase = ms >= PENDING.giveUp ? 'giveup' : ms >= PENDING.long ? 'long' : ms >= PENDING.press ? 'working' : 'press'
    setState((s) => (s.phase === 'idle' || s.phase === 'done' || s.phase === 'error' || s.phase === 'canceled' ? s : { ...s, phase, busy: ms >= PENDING.press, showBlock: ms >= PENDING.show, showTime: ms >= PENDING.time, seconds: Math.floor(ms / 1000) }))
  }, [])

  const run = useCallback(async <T,>(task: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
    if (ctl.current) return undefined
    const c = new AbortController()
    ctl.current = c
    started.current = Date.now()
    setState({ phase: 'press', busy: false, showBlock: false, showTime: false, seconds: 0, error: '' })
    timer.current = window.setInterval(tick, 250)
    try {
      const out = await task(c.signal)
      setState({ phase: 'done', busy: false, showBlock: false, showTime: false, seconds: Math.floor((Date.now() - started.current) / 1000), error: '' })
      return out
    } catch (e) {
      if (c.signal.aborted) setState({ phase: 'canceled', busy: false, showBlock: false, showTime: false, seconds: 0, error: '' })
      else setState({ phase: 'error', busy: false, showBlock: true, showTime: false, seconds: Math.floor((Date.now() - started.current) / 1000), error: e instanceof Error ? e.message : '' })
      return undefined
    } finally {
      stop()
      ctl.current = null
    }
  }, [stop, tick])

  const cancel = useCallback(() => ctl.current?.abort(), [])
  return { state, run, cancel }
}

export type PendingController = ReturnType<typeof usePending>
