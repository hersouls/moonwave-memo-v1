import { useState, useRef, useCallback, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'
import { validateImageFile, extractTextFromImage, type OCRResult } from '@/services/imageOCR'
import { compressImage, type CompressedImage } from '@/utils/imageCompression'
import { addMemoImage } from '@/services/database'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'

export type OCRStatus = 'idle' | 'validating' | 'compressing' | 'extracting' | 'completed' | 'error'

export function useImageOCR() {
  const [status, setStatus] = useState<OCRStatus>('idle')
  const [result, setResult] = useState<OCRResult | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [compressedData, setCompressedData] = useState<CompressedImage | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      current += Math.random() * 6
      if (current > 90) current = 90
      setProgress(Math.round(current))
    }, 600)
  }, [])

  const stopProgressSimulation = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const processImage = useCallback(async (file: File) => {
    const ai = useSettingsStore.getState().settings.ai
    const provider = ai?.ocrProvider || 'openai'
    const apiKey = provider === 'anthropic' ? ai?.anthropicApiKey : provider === 'gemini' ? ai?.geminiApiKey : ai?.openaiApiKey

    // Validate
    setStatus('validating')
    setError(null)
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setError(validation.error || '유효하지 않은 파일입니다')
      setStatus('error')
      return
    }

    // Compress
    setStatus('compressing')
    setOriginalFile(file)
    let compressed: CompressedImage
    try {
      compressed = await compressImage(file)
      setCompressedData(compressed)
      setImagePreview(compressed.dataUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이미지 처리 중 오류가 발생했습니다'
      setError(msg)
      setStatus('error')
      return
    }

    // Extract text
    setStatus('extracting')
    abortRef.current = new AbortController()
    startProgressSimulation()

    try {
      const ocrResult = await extractTextFromImage(
        compressed.dataUrl,
        provider,
        apiKey,
        ai.language || 'ko',
        abortRef.current.signal
      )
      stopProgressSimulation()
      setProgress(100)
      setResult(ocrResult)
      setStatus('completed')
    } catch (err) {
      stopProgressSimulation()
      setProgress(0)
      const msg = err instanceof Error ? err.message : '텍스트 추출 중 오류가 발생했습니다'
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

    // Create memo first
    const newId = await addMemo({
      title: `이미지 OCR 메모 — ${dateStr}`,
      body: editedText,
      folderId: activeFolderId ?? defaultFolderId ?? null,
      color: defaultColor,
    })

    // Save image to memoImages table and update body with image reference
    if (compressedData && originalFile && newId) {
      const imageId = await addMemoImage({
        memoId: newId,
        syncId: generateSyncId(),
        data: compressedData.dataUrl,
        filename: originalFile.name,
        width: compressedData.width,
        height: compressedData.height,
        size: compressedData.originalSize,
        createdAt: nowISO(),
      })

      const imageMarkdown = `\n\n![OCR 이미지](memo-image:${imageId})`
      const updateMemo = useMemoStore.getState().updateMemo
      await updateMemo(newId, { body: editedText + imageMarkdown })
    }

    return newId
  }, [compressedData, originalFile])

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

    let imageMarkdown = ''
    if (compressedData && originalFile) {
      const imageId = await addMemoImage({
        memoId,
        syncId: generateSyncId(),
        data: compressedData.dataUrl,
        filename: originalFile.name,
        width: compressedData.width,
        height: compressedData.height,
        size: compressedData.originalSize,
        createdAt: nowISO(),
      })
      imageMarkdown = `\n![OCR 이미지](memo-image:${imageId})`
    }

    const appendedBody = `${memo.body}\n\n---\nOCR 텍스트 (${dateStr})\n${editedText}${imageMarkdown}`
    await updateMemo(memoId, { body: appendedBody })
  }, [compressedData, originalFile])

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
    setImagePreview(null)
    setCompressedData(null)
    setOriginalFile(null)
    setError(null)
    setProgress(0)
  }, [stopProgressSimulation])

  return {
    status,
    result,
    imagePreview,
    error,
    progress,
    processImage,
    saveAsNewMemo,
    appendToCurrentMemo,
    cancel,
    reset,
  }
}
