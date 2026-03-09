import { useState, useRef, useEffect } from 'react'
import { X, Send, RefreshCw, Brain, Settings } from 'lucide-react'
import clsx from 'clsx'
import { useAlterEgo } from '@/hooks/useAlterEgo'
import { useUIStore } from '@/stores/uiStore'

interface AlterEgoPanelProps {
  body: string
  onClose: () => void
}

export function AlterEgoPanel({ body, onClose }: AlterEgoPanelProps) {
  const {
    messages,
    sendMessage,
    isLoading,
    exchangeCount,
    maxExchanges,
    error,
    reset,
    hasApiKey,
  } = useAlterEgo(body)

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage(text)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Prevent Escape from propagating to editor
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  // No API key state
  if (!hasApiKey) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">데미안</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Brain className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            AI 서비스를 사용하려면 API 키가 필요합니다
          </p>
          <button
            onClick={() => useUIStore.getState().openSettingsModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            설정 열기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">데미안</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
            {exchangeCount}/{maxExchanges}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={reset}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            title="대화 초기화"
            aria-label="대화 초기화"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4">
            <Brain className="w-8 h-8 text-zinc-200 dark:text-zinc-700" />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              데미안은 당신의 또 다른 자아입니다.
              <br />
              글쓰기에 대해 질문하거나 생각을 나눠보세요.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={clsx(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={clsx(
                'max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-md'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-bl-md italic'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-xs text-danger-500 px-2 py-1">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={exchangeCount >= maxExchanges ? '대화 횟수 초과' : '생각을 나눠보세요...'}
            disabled={exchangeCount >= maxExchanges || isLoading}
            className="flex-1 text-sm px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-primary-400 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || exchangeCount >= maxExchanges}
            className="p-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            aria-label="보내기"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
