import { useRef, useCallback } from 'react'

export function useTypingSounds(enabled: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playKeySound = useCallback(() => {
    if (!enabled) return
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800 + Math.random() * 200
      osc.type = 'sine'
      gain.gain.value = 0.03
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.08)
    } catch {
      /* ignore audio errors */
    }
  }, [enabled])

  return { playKeySound }
}
