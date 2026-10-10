import { useState } from 'react'
import { summarizeMemo } from '@/services/aiFeatures'
import { IcLineChevronDown, IcLineChevronUp, IcLineLoading, IcMwSparkles } from '@/mw/icons'

interface AISummaryPanelProps {
  content: string
}

export function AISummaryPanel({ content }: AISummaryPanelProps) {
  const [summary, setSummary] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError('')
    const result = await summarizeMemo(content)
    if (result.error) {
      setError(result.error)
    } else {
      setSummary(result.summary)
    }
    setIsLoading(false)
    setIsOpen(true)
  }

  if (!content.trim() || content.length < 50) return null

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      <button
        onClick={summary ? () => setIsOpen(!isOpen) : handleGenerate}
        type="button"
        className="mw-button mw-button--tertiary-subtle mw-button--large w-full justify-start"
      >
        {isLoading ? (
          <IcLineLoading size={16} className="animate-spin text-primary-500" />
        ) : (
          <IcMwSparkles size={16} className="text-primary-500" />
        )}
        <span className="flex-1 text-left">AI 요약</span>
        {summary && (
          isOpen ? <IcLineChevronUp size={16} /> : <IcLineChevronDown size={16} />
        )}
      </button>

      {isOpen && (summary || error) && (
        <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {error ? (
            <p className="text-xs text-danger-500">{error}</p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {summary}
            </p>
          )}
          <button type="button"
            onClick={handleGenerate}
            className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default mt-2"
          >
            <span>다시 만들기</span>
          </button>
        </div>
      )}
    </div>
  )
}
