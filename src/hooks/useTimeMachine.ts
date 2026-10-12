import { useEffect, useRef, useState, useCallback } from 'react'
import type { ContextSnapshot, WeatherCondition } from '@/lib/types'
import { useThemeOrchestrator } from '@/stores/themeOrchestratorStore'

type ExtendedPalette =
  | 'default' | 'ocean' | 'rose' | 'purple' | 'forest'
  | 'monochrome' | 'victory-gold'
  | 'weather-clear' | 'weather-rain' | 'weather-snow' | 'weather-overcast'

function weatherToPalette(weather: WeatherCondition): ExtendedPalette {
  switch (weather) {
    case 'clear': return 'weather-clear'
    case 'rain': return 'weather-rain'
    case 'snow': return 'weather-snow'
    case 'overcast': return 'weather-overcast'
    default: return 'default'
  }
}

function createAmbientSound(
  ctx: AudioContext,
  weather: WeatherCondition
): { nodes: AudioNode[]; stop: () => void } {
  const nodes: AudioNode[] = []

  const masterGain = ctx.createGain()
  masterGain.gain.value = 0
  masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2)
  masterGain.connect(ctx.destination)
  nodes.push(masterGain)

  if (weather === 'rain') {
    // White noise + lowpass filter at 800Hz
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 800

    const gain = ctx.createGain()
    gain.gain.value = 0.015

    source.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)
    source.start()
    nodes.push(source, filter, gain)
  } else if (weather === 'clear') {
    // High sine at 1200Hz, very low gain
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1200
    const gain = ctx.createGain()
    gain.gain.value = 0.005
    osc.connect(gain)
    gain.connect(masterGain)
    osc.start()
    nodes.push(osc, gain)
  } else if (weather === 'snow') {
    // Triangle at 400Hz + lowpass 200Hz
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 400
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 200
    const gain = ctx.createGain()
    gain.gain.value = 0.008
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)
    osc.start()
    nodes.push(osc, filter, gain)
  } else {
    // Overcast: brown noise (filtered white noise), gain 0.005
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      data[i] = (lastOut + 0.02 * white) / 1.02
      lastOut = data[i]
      data[i] *= 3.5 // Compensate for volume loss
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0.005
    source.connect(gain)
    gain.connect(masterGain)
    source.start()
    nodes.push(source, gain)
  }

  const stop = () => {
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
    setTimeout(() => {
      nodes.forEach((n) => {
        try {
          if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
            (n as OscillatorNode).stop()
          }
          n.disconnect()
        } catch { /* already stopped */ }
      })
    }, 1200)
  }

  return { nodes, stop }
}

export function useTimeMachine(
  contextSnapshot: ContextSnapshot | undefined,
  enabled: boolean
) {
  const [isActive, setIsActive] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const stopAudioRef = useRef<(() => void) | null>(null)
  const cleanupRef = useRef(false)

  const dismiss = useCallback(() => {
    setIsActive(false)
    // Clear manual override
    useThemeOrchestrator.getState().clearManualOverride()
    // Stop audio
    if (stopAudioRef.current) {
      stopAudioRef.current()
      stopAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || !contextSnapshot) {
      return
    }

    cleanupRef.current = false

    // Apply weather palette via theme orchestrator manual override
    if (contextSnapshot.weather) {
      const palette = weatherToPalette(contextSnapshot.weather)
      useThemeOrchestrator.getState().setManualOverride(palette)
    }

    // 테마는 바꾸지 않아요: 화면의 밝기는 키트의 테마 엔진만 정해요 (https://ux.moonwave.kr/patterns/theme#rule).
    // 예전에는 밤에 쓴 메모를 열면 어두운 테마로 바꿨고, 그 값이 이 기기가 고른 테마로 남았어요.

    // Start ambient sound
    if (contextSnapshot.weather) {
      try {
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const { stop } = createAmbientSound(ctx, contextSnapshot.weather)
        stopAudioRef.current = stop
      } catch { /* Web Audio not available */ }
    }

    setIsActive(true)

    return () => {
      if (!cleanupRef.current) {
        cleanupRef.current = true
        useThemeOrchestrator.getState().clearManualOverride()
        if (stopAudioRef.current) {
          stopAudioRef.current()
          stopAudioRef.current = null
        }
        if (audioCtxRef.current) {
          // Delay close to let gain ramp complete (stopAudio uses ctx.currentTime)
          const ctx = audioCtxRef.current
          audioCtxRef.current = null
          setTimeout(() => ctx.close().catch(() => {}), 1500)
        }
      }
    }
  }, [enabled, contextSnapshot])

  return { isActive, dismiss }
}
