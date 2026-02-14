import { useState, useRef, useCallback, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'
import { validateAudioFile, transcribeAudio, formatTranscription, type STTResult } from '@/services/speechToText'

export type TranscriptionStatus = 'idle' | 'validating' | 'transcribing' | 'completed' | 'error'

export function useVoiceTranscription() {
  const [status, setStatus] = useState<TranscriptionStatus>('idle')
  const [result, setResult] = useState<STTResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [])

  const startProgressSimulation = useCallback(() => {
    setProgress(10)
    let current = 10
    progressTimerRef.current = setInterval(() => {
      current += Math.random() * 8
      if (current > 90) current = 90
      setProgress(Math.round(current))
    }, 500)
  }, [])

  const stopProgressSimulation = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const uploadAndTranscribe = useCallback(async (file: File) => {
    const ai = useSettingsStore.getState().settings.ai
    if (!ai?.apiKey) {
      setError('설정에서 API 키를 먼저 입력해주세요')
      setStatus('error')
      return
    }

    // Validate
    setStatus('validating')
    setError(null)
    const validation = validateAudioFile(file)
    if (!validation.valid) {
      setError(validation.error || '유효하지 않은 파일입니다')
      setStatus('error')
      return
    }

    // Transcribe
    setStatus('transcribing')
    abortRef.current = new AbortController()
    startProgressSimulation()

    try {
      const sttResult = await transcribeAudio(
        file,
        ai.apiKey,
        ai.language || 'ko',
        abortRef.current.signal
      )
      stopProgressSimulation()
      setProgress(100)
      setResult(sttResult)
      setStatus('completed')
    } catch (err) {
      stopProgressSimulation()
      setProgress(0)
      const msg = err instanceof Error ? err.message : '음성 변환 중 오류가 발생했습니다'
      setError(msg)
      setStatus('error')
    }
  }, [startProgressSimulation, stopProgressSimulation])

  const saveAsNewMemo = useCallback(async (editedText: string) => {
    const addMemo = useMemoStore.getState().addMemo
    const activeFolderId = useUIStore.getState().activeFolderId
    const defaultFolderId = useSettingsStore.getState().settings.memoSettings.defaultFolderId
    const defaultColor = useSettingsStore.getState().settings.memoSettings.defaultColor

    const now = new Date()
    const dateStr = now.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const newId = await addMemo({
      title: `음성 메모 — ${dateStr}`,
      body: editedText,
      folderId: activeFolderId ?? defaultFolderId ?? null,
      color: defaultColor,
    })

    return newId
  }, [])

  const appendToCurrentMemo = useCallback(async (memoId: number, editedText: string) => {
    const updateMemo = useMemoStore.getState().updateMemo
    const memos = useMemoStore.getState().memos
    const memo = memos.find((m) => m.id === memoId)
    if (!memo) return

    const now = new Date()
    const dateStr = now.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const appendedBody = `${memo.body}\n\n---\n음성 텍스트 (${dateStr})\n${editedText}`
    await updateMemo(memoId, { body: appendedBody })
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    stopProgressSimulation()
    setStatus('idle')
    setProgress(0)
    setError(null)
  }, [stopProgressSimulation])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    stopProgressSimulation()
    setStatus('idle')
    setResult(null)
    setError(null)
    setProgress(0)
  }, [stopProgressSimulation])

  return {
    status,
    result,
    error,
    progress,
    uploadAndTranscribe,
    saveAsNewMemo,
    appendToCurrentMemo,
    cancel,
    reset,
    formatTranscription,
  }
}
