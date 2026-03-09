import { useState, useRef, useCallback, useEffect } from 'react'

export type RecorderStatus = 'idle' | 'requesting-permission' | 'recording' | 'paused' | 'stopped' | 'error'

const MAX_DURATION = 600 // 10 minutes in seconds
const LEVEL_UPDATE_INTERVAL = 80 // ~12fps for audio level — enough for smooth bars, 5x less work than 60fps

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return 'audio/webm'
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const pausedDurationRef = useRef(0)
  const stoppedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const statusRef = useRef<RecorderStatus>('idle')
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Reusable buffer to avoid allocation per frame
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const cleanup = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current)
      levelTimerRef.current = null
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close().catch(() => {})
    }
    audioContextRef.current = null
    analyserRef.current = null
    frequencyDataRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  // Duration timer: update every 1s (not every frame)
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    durationTimerRef.current = setInterval(() => {
      if (statusRef.current !== 'recording' || stoppedRef.current) return
      const elapsed = pausedDurationRef.current + (Date.now() - startTimeRef.current) / 1000
      setDuration(Math.floor(elapsed))
      // Auto-stop at max duration
      if (elapsed >= MAX_DURATION) {
        stoppedRef.current = true
        mediaRecorderRef.current?.stop()
      }
    }, 1000)
  }, [])

  // Audio level timer: update at throttled rate (~12fps)
  const startLevelTimer = useCallback(() => {
    if (levelTimerRef.current) clearInterval(levelTimerRef.current)
    levelTimerRef.current = setInterval(() => {
      if (statusRef.current !== 'recording' || !analyserRef.current) return
      const analyser = analyserRef.current
      if (!frequencyDataRef.current) {
        frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount)
      }
      const data = frequencyDataRef.current
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length / 255
      setAudioLevel(avg)
    }, LEVEL_UPDATE_INTERVAL)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    setDuration(0)
    pausedDurationRef.current = 0
    stoppedRef.current = false
    chunksRef.current = []
    setStatus('requesting-permission')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio analysis
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7 // Smooth out jitter
      source.connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Set up MediaRecorder
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setStatus('stopped')
        cleanup()
      }

      recorder.start(250) // Collect data every 250ms
      startTimeRef.current = Date.now()
      setStatus('recording')
      startDurationTimer()
      startLevelTimer()
    } catch (err) {
      cleanup()
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.')
        } else if (err.name === 'NotFoundError') {
          setError('마이크를 찾을 수 없습니다.')
        } else {
          setError('마이크 접근 중 오류가 발생했습니다.')
        }
      } else {
        setError('이 브라우저에서는 녹음을 지원하지 않습니다.')
      }
      setStatus('error')
    }
  }, [cleanup, startDurationTimer, startLevelTimer])

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      pausedDurationRef.current += (Date.now() - startTimeRef.current) / 1000
      if (levelTimerRef.current) {
        clearInterval(levelTimerRef.current)
        levelTimerRef.current = null
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
        durationTimerRef.current = null
      }
      setAudioLevel(0)
      setStatus('paused')
    }
  }, [])

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      startTimeRef.current = Date.now()
      setStatus('recording')
      startDurationTimer()
      startLevelTimer()
    }
  }, [startDurationTimer, startLevelTimer])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    cleanup()
    chunksRef.current = []
    pausedDurationRef.current = 0
    stoppedRef.current = false
    setStatus('idle')
    setDuration(0)
    setAudioBlob(null)
    setError(null)
    setAudioLevel(0)
  }, [cleanup])

  return {
    status,
    duration,
    audioBlob,
    error,
    audioLevel,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
