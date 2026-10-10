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

    // Validate
    setStatus('validating')
    setError(null)
    const validation = validateAudioFile(file)
    if (!validation.valid) {
      setError(validation.error || '쓸 수 없는 파일이에요. 다른 파일을 골라 주세요')
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
        ai?.openaiApiKey || '',
        ai?.language || 'ko',
        abortRef.current.signal
      )
      stopProgressSimulation()
      setProgress(100)
      setResult(sttResult)
      setStatus('completed')
    } catch (err) {
      stopProgressSimulation()
      setProgress(0)
      const msg = err instanceof Error ? err.message : '음성을 받아 적지 못했어요. 다시 시도해 주세요'
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
