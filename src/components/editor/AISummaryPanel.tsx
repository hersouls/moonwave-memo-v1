import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { summarizeMemo } from '@/services/aiFeatures'

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
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
        ) : (
          <Sparkles className="h-4 w-4 text-primary-500" />
        )}
        <span className="flex-1 text-left">AI 요약</span>
        {summary && (
          isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isOpen && (summary || error) && (
        <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {error ? (
            <p className="text-xs text-danger-500">{error}</p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {summary}
            </p>
          )}
          <button
            onClick={handleGenerate}
            className="mt-2 text-xs text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            다시 생성
          </button>
        </div>
      )}
    </div>
  )
}
