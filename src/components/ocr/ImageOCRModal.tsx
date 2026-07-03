import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ImagePlus,
  Camera,
  Upload,
  X,
  Loader2,
  ScanText,
} from 'lucide-react'
import clsx from 'clsx'
import { Dialog, DialogHeader, DialogBody } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'
import { useImageOCR } from '@/hooks/useImageOCR'

type ModalStep = 1 | 2 | 3
type InputTab = 'upload' | 'camera'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Scan Animation ─────────────────────────────
function ScanAnimation() {
  return (
    <div className="relative w-20 h-20 mx-auto">
      <div className="absolute inset-0 rounded-xl border-2 border-primary-500/30" />
      <div
        className="absolute left-0 right-0 h-0.5 bg-primary-500"
        style={{
          animation: 'scanLine 2s ease-in-out infinite',
        }}
      />
      <ScanText className="absolute inset-0 m-auto w-8 h-8 text-primary-500/60" />
    </div>
  )
}

// ─── Step 1: Image Selection ────────────────────
function StepImageSelect({
  onImageSelect,
}: {
  onImageSelect: (file: File) => void
}) {
  const [activeTab, setActiveTab] = useState<InputTab>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (file: File) => {
    setFileError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
    if (!validExts.includes(ext) && !file.type.startsWith('image/')) {
      setFileError(`지원하지 않는 파일 형식입니다. 지원: ${validExts.join(', ')}`)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setFileError(`파일 크기가 20MB를 초과합니다 (${(file.size / (1024 * 1024)).toFixed(1)}MB)`)
      return
    }
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileChange(file)
  }

  const clearSelection = () => {
    setSelectedFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFileError(null)
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--color-border-subtle)]">
        <button
          onClick={() => setActiveTab('upload')}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'upload'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          )}
        >
          <Upload className="w-4 h-4" />
          이미지 업로드
        </button>
        <button
          onClick={() => setActiveTab('camera')}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'camera'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          )}
        >
          <Camera className="w-4 h-4" />
          카메라 촬영
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div className="space-y-3">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="이미지 파일 선택"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={clsx(
              'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-[border-color,background-color]',
              dragOver
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
            )}
          >
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                이미지를 여기에 놓거나 클릭하세요
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                JPG, PNG, GIF, WebP (최대 20MB)
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileChange(file)
              e.target.value = ''
            }}
            className="hidden"
          />
        </div>
      ) : (
        /* Camera tab */
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
            <Camera className="w-8 h-8 text-primary-500" />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
            카메라로 사진을 촬영하여<br />텍스트를 추출합니다
          </p>
          <Button
            variant="primary"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="w-4 h-4 mr-1.5" />
            사진 촬영
          </Button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileChange(file)
              e.target.value = ''
            }}
            className="hidden"
          />
        </div>
      )}

      {/* File error */}
      {fileError && (
        <p className="text-xs text-danger-500 dark:text-danger-400 px-1">{fileError}</p>
      )}

      {/* Selected file preview */}
      {selectedFile && preview && !fileError && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-[var(--color-border-subtle)] bg-zinc-50 dark:bg-zinc-800/50">
            <img
              src={preview}
              alt="선택된 이미지"
              className="w-full max-h-48 object-contain"
            />
            <button
              onClick={(e) => { e.stopPropagation(); clearSelection() }}
              aria-label="선택한 이미지 제거"
              className="absolute top-2 right-2 flex items-center justify-center w-10 h-10 -m-1 rounded-full text-white transition-colors group/clear"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black/50 group-hover/clear:bg-black/70 transition-colors">
                <X className="w-4 h-4" />
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2 px-1">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex-1">
              {selectedFile.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">{formatFileSize(selectedFile.size)}</p>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => onImageSelect(selectedFile)}
          >
            <ScanText className="w-4 h-4 mr-1.5" />
            OCR 시작
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Processing ─────────────────────────
function StepProcessing({
  progress,
  imagePreview,
  onCancel,
}: {
  progress: number
  imagePreview: string | null
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {imagePreview && (
        <div className="w-24 h-24 rounded-xl overflow-hidden border border-[var(--color-border-subtle)] opacity-60">
          <img src={imagePreview} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <ScanAnimation />

      <div className="text-center">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          이미지에서 텍스트를 추출하고 있습니다...
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          이미지 내용에 따라 시간이 걸릴 수 있습니다
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums text-center mt-2">{progress}%</p>
      </div>

      <Button variant="ghost" onClick={onCancel}>
        취소
      </Button>
    </div>
  )
}

// ─── Step 3: Result ─────────────────────────────
function StepResult({
  text,
  imagePreview,
  isEmptyResult,
  onRetry,
  onTextChange,
  onSaveNew,
  onAppend,
  canAppend,
  isSaving,
}: {
  text: string
  imagePreview: string | null
  isEmptyResult: boolean
  onRetry: () => void
  onTextChange: (t: string) => void
  onSaveNew: () => void
  onAppend: () => void
  canAppend: boolean
  isSaving: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Image thumbnail */}
      {imagePreview && (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <img
            src={imagePreview}
            alt="OCR 원본"
            className="w-12 h-12 rounded-lg object-cover border border-[var(--color-border-subtle)]"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            원본 이미지가 메모에 함께 저장됩니다
          </p>
        </div>
      )}

      {/* Empty OCR result state */}
      {isEmptyResult && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <ScanText className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            이미지에서 텍스트를 찾지 못했습니다
          </p>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            다른 이미지 시도
          </Button>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={isEmptyResult ? '직접 텍스트를 입력할 수도 있습니다' : undefined}
        className="w-full min-h-[200px] max-h-60 p-3 rounded-xl border border-[var(--color-border-default)] bg-white dark:bg-zinc-900/50 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-primary-500 overflow-y-auto"
      />

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{text.length}자</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="primary"
          className="flex-1"
          onClick={onSaveNew}
          disabled={!text.trim() || isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
          새 메모로 저장
        </Button>
        {canAppend && (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onAppend}
            disabled={!text.trim() || isSaving}
          >
            기존 메모에 추가
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Main Modal ─────────────────────────────────
export function ImageOCRModal() {
  const isOpen = useUIStore((s) => s.isImageOCRModalOpen)
  const closeModal = useUIStore((s) => s.closeImageOCRModal)
  const showToast = useToastStore((s) => s.showToast)
  const navigate = useNavigate()
  const { id: routeMemoId } = useParams<{ id: string }>()

  const ocr = useImageOCR()
  const [step, setStep] = useState<ModalStep>(1)
  const [editedText, setEditedText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setEditedText('')
      setIsSaving(false)
      ocr.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Auto-advance based on OCR status
  useEffect(() => {
    if (ocr.status === 'completed' && ocr.result) {
      setEditedText(ocr.result.text)
      setStep(3)
    }
    if (ocr.status === 'error' && ocr.error) {
      showToast(ocr.error, 'error')
      setStep(1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocr.status])

  const handleImageSelect = useCallback((file: File) => {
    setStep(2)
    ocr.processImage(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = useCallback(() => {
    ocr.cancel()
    setStep(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 빈 결과에서 "다른 이미지 시도" — 상태를 비우고 1단계로 복귀
  const handleRetry = useCallback(() => {
    ocr.reset()
    setEditedText('')
    setStep(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveNew = async () => {
    setIsSaving(true)
    try {
      const newId = await ocr.saveAsNewMemo(editedText)
      closeModal()
      showToast('이미지 OCR 메모가 저장되었습니다', 'success')
      if (newId) navigate(`/memo/${newId}`)
    } catch {
      showToast('저장 중 오류가 발생했습니다', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAppend = async () => {
    const memoId = routeMemoId ? Number(routeMemoId) : null
    if (!memoId) {
      showToast('편집 중인 메모가 없습니다', 'warning')
      return
    }
    setIsSaving(true)
    try {
      await ocr.appendToCurrentMemo(memoId, editedText)
      closeModal()
      showToast('메모에 추가되었습니다', 'success')
    } catch {
      showToast('추가 중 오류가 발생했습니다', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const canAppend = !!routeMemoId && routeMemoId !== 'new'

  const stepTitles: Record<ModalStep, string> = {
    1: '이미지 OCR',
    2: '텍스트 추출 중',
    3: '추출 결과',
  }

  return (
    <Dialog open={isOpen} onClose={step === 2 ? handleCancel : closeModal} size="lg" noPadding>
      <div className="flex flex-col max-h-[85dvh] fold:max-h-[70dvh]">
        <DialogHeader
          title={stepTitles[step]}
          onClose={step === 2 ? undefined : closeModal}
        />

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 px-6 pb-3">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={clsx(
                'h-1.5 rounded-full transition-[width,background-color] duration-300',
                s === step ? 'w-8 bg-primary-500' : 'w-4 bg-zinc-200 dark:bg-zinc-700'
              )}
            />
          ))}
        </div>

        <DialogBody className="overflow-y-auto px-4 pb-6 sm:px-6">
          {/* 단계 전환 크로스 슬라이드 — key 교체로 enter 애니메이션 재생 */}
          <div
            key={step}
            className="animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDuration: '250ms', animationTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          >
            {step === 1 && (
              <StepImageSelect onImageSelect={handleImageSelect} />
            )}
            {step === 2 && (
              <StepProcessing
                progress={ocr.progress}
                imagePreview={ocr.imagePreview}
                onCancel={handleCancel}
              />
            )}
            {step === 3 && (
              <StepResult
                text={editedText}
                imagePreview={ocr.imagePreview}
                isEmptyResult={!(ocr.result?.text ?? '').trim()}
                onRetry={handleRetry}
                onTextChange={setEditedText}
                onSaveNew={handleSaveNew}
                onAppend={handleAppend}
                canAppend={canAppend}
                isSaving={isSaving}
              />
            )}
          </div>
        </DialogBody>
      </div>
    </Dialog>
  )
}
