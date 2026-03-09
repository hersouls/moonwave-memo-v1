import { useEffect, useRef, useCallback } from 'react'
import type { Mood } from '@/services/sentimentAnalysis'

interface AmbientSoundscapeOptions {
  enabled: boolean
  bodyLength: number
  sentiment: Mood
}

export function useAmbientSoundscape({ enabled, bodyLength, sentiment }: AmbientSoundscapeOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const droneOscRef = useRef<OscillatorNode | null>(null)
  const droneGainRef = useRef<GainNode | null>(null)
  const padOscsRef = useRef<OscillatorNode[]>([])
  const padGainsRef = useRef<GainNode[]>([])
  const userGesturedRef = useRef(false)
  const isSetUpRef = useRef(false)

  // Initialize AudioContext after first user gesture (keystroke)
  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      return ctx
    } catch {
      return null
    }
  }, [])

  // Set up base drone and harmonic pad
  const setupSoundscape = useCallback(() => {
    if (isSetUpRef.current || !enabled) return
    const ctx = ensureAudioContext()
    if (!ctx) return

    isSetUpRef.current = true

    // Base drone: sine oscillator
    const droneFreq = Math.max(60, Math.min(120, 120 - bodyLength / 100))
    const droneOsc = ctx.createOscillator()
    droneOsc.type = 'sine'
    droneOsc.frequency.value = droneFreq
    const droneGain = ctx.createGain()
    droneGain.gain.value = 0
    droneGain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 2)
    droneOsc.connect(droneGain)
    droneGain.connect(ctx.destination)
    droneOsc.start()
    droneOscRef.current = droneOsc
    droneGainRef.current = droneGain

    // Harmonic pad: root + optional intervals based on sentiment
    const root = 220
    const frequencies: number[] = [root]
    if (sentiment === 'positive') {
      frequencies.push(277, 330) // major third + fifth
    } else if (sentiment === 'negative') {
      frequencies.push(261, 330) // minor third + fifth
    }
    // neutral: just the root

    const oscs: OscillatorNode[] = []
    const gains: GainNode[] = []
    for (const freq of frequencies) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      oscs.push(osc)
      gains.push(gain)
    }
    padOscsRef.current = oscs
    padGainsRef.current = gains
  }, [enabled, bodyLength, sentiment, ensureAudioContext])

  // Play a brief note on keystroke
  const playNote = useCallback((charCode: number) => {
    if (!enabled) return

    // Mark that user has gestured
    if (!userGesturedRef.current) {
      userGesturedRef.current = true
      setupSoundscape()
    }

    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    try {
      const pitch = (charCode % 12) * 50 + 200
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = pitch
      const gain = ctx.createGain()
      gain.gain.value = 0.02
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } catch { /* ignore audio errors */ }
  }, [enabled, setupSoundscape])

  // Update drone frequency when body length changes
  useEffect(() => {
    if (!enabled || !droneOscRef.current || !audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const newFreq = Math.max(60, Math.min(120, 120 - bodyLength / 100))
    droneOscRef.current.frequency.linearRampToValueAtTime(newFreq, ctx.currentTime + 1)
  }, [bodyLength, enabled])

  // Update pad based on sentiment changes
  useEffect(() => {
    if (!enabled || !isSetUpRef.current || !audioCtxRef.current) return
    const ctx = audioCtxRef.current
    let cancelled = false

    // Fade out existing pad oscillators
    for (const gain of padGainsRef.current) {
      try { gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1) } catch { /* ignore */ }
    }
    const timer = setTimeout(() => {
      if (cancelled) return
      for (const osc of padOscsRef.current) {
        try { osc.stop() } catch { /* already stopped */ }
      }

      if (ctx.state === 'closed') return

      // Create new pad based on sentiment
      const root = 220
      const frequencies: number[] = [root]
      if (sentiment === 'positive') {
        frequencies.push(277, 330)
      } else if (sentiment === 'negative') {
        frequencies.push(261, 330)
      }

      const oscs: OscillatorNode[] = []
      const gains: GainNode[] = []
      for (const freq of frequencies) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const gain = ctx.createGain()
        gain.gain.value = 0
        gain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        oscs.push(osc)
        gains.push(gain)
      }
      padOscsRef.current = oscs
      padGainsRef.current = gains
    }, 1100)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sentiment, enabled])

  // Visibility change: suspend/resume
  useEffect(() => {
    if (!enabled) return

    const handleVisibility = () => {
      const ctx = audioCtxRef.current
      if (!ctx) return
      if (document.hidden) {
        ctx.suspend().catch(() => {})
      } else {
        ctx.resume().catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const ctx = audioCtxRef.current
      if (!ctx) return

      // Fade out drone
      if (droneGainRef.current) {
        try {
          droneGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
        } catch { /* ignore */ }
      }
      // Fade out pads
      for (const gain of padGainsRef.current) {
        try {
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
        } catch { /* ignore */ }
      }

      setTimeout(() => {
        try { droneOscRef.current?.stop() } catch { /* already stopped */ }
        for (const osc of padOscsRef.current) {
          try { osc.stop() } catch { /* already stopped */ }
        }
        ctx.close().catch(() => {})
        audioCtxRef.current = null
        isSetUpRef.current = false
      }, 600)
    }
  }, [])

  return { playNote }
}
