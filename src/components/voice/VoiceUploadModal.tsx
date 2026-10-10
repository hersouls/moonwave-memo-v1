import { useState, useRef, useEffect, useCallback, memo as reactMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Dialog, DialogHeader, DialogBody } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { IcFillPause, IcFillPlay, IcLineClose, IcLineLoading, IcLineMic, IcLinePause, IcMwWaveform } from '@/mw/icons'
import { TextArea } from '@/mw/TextArea'

type ModalStep = 1 | 2 | 3
type InputTab = 'upload' | 'record'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Waveform Animation ──────────────────────────
function WaveformAnimation() {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-1 bg-primary-500 rounded-full"
          style={{
            animation: 'waveform var(--motion-duration-loop) var(--motion-easing-ease-in-out) infinite',
            animationDelay: `${i * 0.15}s`,
            height: '8px',
          }}
        />
      ))}
    </div>
  )
}

// ─── Audio Level Bars ────────────────────────────
// Pre-computed sin offsets to avoid Math.sin on every render
const BAR_SIN_OFFSETS = Array.from({ length: 12 }, (_, i) => 1 + Math.sin(i * 0.8) * 0.5)

const AudioLevelBars = reactMemo(function AudioLevelBars({ level }: { level: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {BAR_SIN_OFFSETS.map((offset, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-danger-400 dark:bg-danger-500 transition-[height] duration-100 ease-out will-change-[height]"
          style={{ height: `${Math.max(4, Math.max(0.05, level * offset) * 32)}px` }}
        />
      ))}
    </div>
  )
})

// ─── Step 1: File Selection ─────────────────────
function StepFileSelect({
  onFileSelect,
  onRecordingComplete,
}: {
  onFileSelect: (file: File) => void
  onRecordingComplete: (file: File) => void
}) {
  const [activeTab, setActiveTab] = useState<InputTab>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const recorder = useAudioRecorder()

  const handleFileChange = (file: File) => {
    setFileError(null)
    // Quick extension check
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const validExts = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg']
    if (!validExts.includes(ext)) {
      setFileError(`지원하지 않는 파일 형식입니다. 지원: ${validExts.join(', ')}`)
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setFileError(`파일 크기가 25MB를 초과합니다 (${(file.size / (1024 * 1024)).toFixed(1)}MB)`)
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileChange(file)
  }

  const handleRecordStop = () => {
    recorder.stop()
  }

  // When recording is stopped and we have a blob
  useEffect(() => {
    if (recorder.status === 'stopped' && recorder.audioBlob) {
      const file = new File([recorder.audioBlob], `recording-${Date.now()}.webm`, {
        type: recorder.audioBlob.type || 'audio/webm',
      })
      onRecordingComplete(file)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.status, recorder.audioBlob])

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="mw-tab-group mw-tab-group--fixed" role="tablist" aria-label="넣는 방법">
        <button type="button" role="tab" aria-selected={activeTab === 'upload'} onClick={() => setActiveTab('upload')} className={`mw-tab mw-tab--fixed mw-tab--${activeTab === 'upload' ? 'selected' : 'default'}`}>
          파일 업로드
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'record'} onClick={() => setActiveTab('record')} className={`mw-tab mw-tab--fixed mw-tab--${activeTab === 'record' ? 'selected' : 'default'}`}>
          직접 녹음
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div className="space-y-3">
          {/* Drop zone */}
          <div
            role="group"
            aria-label="음성 파일 선택"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-[border-color,background-color]',
              dragOver
                ? 'border-primary-500 bg-primary-50/50 '
                : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
            )}
          >
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <IcMwWaveform size={24} className="text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                음성 파일을 여기에 놓아요
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                MP3, WAV, M4A, WebM, OGG (최대 25MB)
              </p>
              <button type="button" className="mw-button mw-button--secondary mw-button--medium mt-3" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                파일 고르기
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.mp4,.mpeg,.m4a,.wav,.webm,.ogg"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileChange(file)
              e.target.value = ''
            }}
            className="hidden"
          />

          {/* File error */}
          {fileError && (
            <p className="text-xs text-danger-500 dark:text-danger-400 px-1">{fileError}</p>
          )}

          {/* Selected file */}
          {selectedFile && !fileError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-[var(--color-border-subtle)]">
              <IcMwWaveform size={20} className="text-primary-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                aria-label="선택한 파일 제거"
                className="mw-icon-button shrink-0 -m-2"
              >
                <IcLineClose size={16} />
              </button>
            </div>
          )}

          {selectedFile && !fileError && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => onFileSelect(selectedFile)}
            >
              변환 시작
            </Button>
          )}
        </div>
      ) : recorder.status === 'error' ? (
        /* Record tab — 마이크 사용 불가 전용 상태 */
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-danger-50 dark:bg-danger-900/20 flex items-center justify-center">
            <IcLineMic size={32} className="text-danger-500 dark:text-danger-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            마이크를 사용할 수 없습니다
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] max-w-xs">
            {recorder.error}
          </p>
          <Button variant="secondary" size="sm" onClick={recorder.start} className="mt-1">
            다시 시도
          </Button>
        </div>
      ) : (
        /* Record tab */
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Duration display */}
          <div className="text-3xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-200 tabular-nums">
            {recorder.status === 'recording' || recorder.status === 'paused' ? (
              <span className="flex items-center gap-2">
                {recorder.status === 'recording' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-danger-500 animate-pulse" />
                )}
                {formatDuration(recorder.duration)}
              </span>
            ) : (
              '00:00'
            )}
          </div>

          {/* Audio level visualization */}
          {(recorder.status === 'recording' || recorder.status === 'paused') && (
            <AudioLevelBars level={recorder.status === 'recording' ? recorder.audioLevel : 0} />
          )}

          {/* Max duration indicator */}
          {(recorder.status === 'recording' || recorder.status === 'paused') && (
            <div className="w-full max-w-[200px]">
              <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-danger-400 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${(recorder.duration / 600) * 100}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-1">최대 10분</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            {recorder.status === 'idle' || recorder.status === 'requesting-permission' ? (
              <button type="button"
                onClick={recorder.start}
                disabled={recorder.status === 'requesting-permission'}
                className="mw-fab mw-fab--fab"
                aria-label="녹음 시작"
              >
                <IcLineMic size={32} />
              </button>
            ) : (
              <>
                {/* Pause/Resume */}
                <button type="button"
                  onClick={recorder.status === 'paused' ? recorder.resume : recorder.pause}
                  className="mw-fab mw-fab--inverse"
                  aria-label={recorder.status === 'paused' ? '재개' : '일시정지'}
                >
                  {recorder.status === 'paused' ? (
                    <IcFillPlay size={20} className="ml-0.5" />
                  ) : (
                    <IcLinePause size={20} />
                  )}
                </button>

                {/* Stop */}
                <button type="button"
                  onClick={handleRecordStop}
                  className="mw-icon-button"
                  aria-label="녹음 중지"
                >
                  <IcFillPause size={24} className="fill-current" />
                </button>
              </>
            )}
          </div>

          {recorder.status === 'idle' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              버튼을 눌러 녹음을 시작하세요
            </p>
          )}
          {recorder.status === 'requesting-permission' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400" role="status">
              마이크 권한을 확인하는 중...
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Transcribing ───────────────────────
function StepTranscribing({
  progress,
  onCancel,
}: {
  progress: number
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <WaveformAnimation />
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          음성을 텍스트로 변환하고 있습니다...
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          파일 크기에 따라 시간이 걸릴 수 있습니다
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-[width] duration-300 ease-out"
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
  hasSegments,
  onTextChange,
  onTimestampToggle,
  includeTimestamps,
  onSaveNew,
  onAppend,
  canAppend,
  isSaving,
}: {
  text: string
  hasSegments: boolean
  onTextChange: (t: string) => void
  onTimestampToggle: () => void
  includeTimestamps: boolean
  onSaveNew: () => void
  onAppend: () => void
  canAppend: boolean
  isSaving: boolean
}) {
  return (
    <div className="space-y-4">
      <TextArea
        label="받아 적은 글"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
      />

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{text.length}자</span>
        {hasSegments && (
          <button type="button" aria-pressed={includeTimestamps}
            onClick={onTimestampToggle}
            className={`mw-select-chip mw-select-chip--${includeTimestamps ? 'on' : 'off'}`}
          >
            타임스탬프 {includeTimestamps ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="primary"
          className="flex-1"
          onClick={onSaveNew}
          disabled={!text.trim() || isSaving}
        >
          {isSaving ? <IcLineLoading size={16} className="animate-spin mr-1.5" /> : null}
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
export function VoiceUploadModal() {
  const isOpen = useUIStore((s) => s.isVoiceModalOpen)
  const closeModal = useUIStore((s) => s.closeVoiceModal)
  const showToast = useToastStore((s) => s.showToast)
  const navigate = useNavigate()
  const { id: routeMemoId } = useParams<{ id: string }>()

  const transcription = useVoiceTranscription()
  const [step, setStep] = useState<ModalStep>(1)
  const [editedText, setEditedText] = useState('')
  const [includeTimestamps, setIncludeTimestamps] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setEditedText('')
      setIncludeTimestamps(true)
      setIsSaving(false)
      transcription.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Auto-advance when transcription completes
  useEffect(() => {
    if (transcription.status === 'completed' && transcription.result) {
      const text = transcription.formatTranscription(transcription.result, includeTimestamps)
      setEditedText(text)
      setStep(3)
    }
    if (transcription.status === 'error' && transcription.error) {
      showToast(transcription.error, 'error')
      setStep(1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription.status])

  // Update text when timestamp toggle changes
  useEffect(() => {
    if (transcription.result) {
      setEditedText(transcription.formatTranscription(transcription.result, includeTimestamps))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTimestamps])

  const handleFileSelect = useCallback((file: File) => {
    setStep(2)
    transcription.uploadAndTranscribe(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = useCallback(() => {
    transcription.cancel()
    setStep(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveNew = async () => {
    setIsSaving(true)
    try {
      const newId = await transcription.saveAsNewMemo(editedText)
      closeModal()
      showToast('음성 메모가 저장되었습니다', 'success')
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
      await transcription.appendToCurrentMemo(memoId, editedText)
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
    1: '음성 입력',
    2: '변환 중',
    3: '변환 결과',
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
            style={{ animationDuration: 'var(--motion-duration-medium)', animationTimingFunction: 'var(--mw-ease)' }}
          >
            {step === 1 && (
              <StepFileSelect
                onFileSelect={handleFileSelect}
                onRecordingComplete={handleFileSelect}
              />
            )}
            {step === 2 && (
              <StepTranscribing
                progress={transcription.progress}
                onCancel={handleCancel}
              />
            )}
            {step === 3 && (
              <StepResult
                text={editedText}
                hasSegments={!!transcription.result?.segments?.length}
                onTextChange={setEditedText}
                onTimestampToggle={() => setIncludeTimestamps(!includeTimestamps)}
                includeTimestamps={includeTimestamps}
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
