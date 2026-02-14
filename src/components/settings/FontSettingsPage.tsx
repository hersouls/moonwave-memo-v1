import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@/stores/settingsStore'
import { FONT_FAMILIES, FONT_SIZES } from '@/utils/constants'
import type { FontFamily, FontSize } from '@/lib/types'

export function FontSettingsPage() {
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const setFontFamily = useSettingsStore((s) => s.setFontFamily)
  const setFontSize = useSettingsStore((s) => s.setFontSize)

  const currentFont = FONT_FAMILIES.find((f) => f.id === settings.fontFamily)
  const currentSizeIdx = FONT_SIZES.findIndex((s) => s.id === settings.fontSize)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 lg:px-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">글자 크기·글꼴</h1>
      </div>

      {/* Preview Card */}
      <div className="mx-4 lg:mx-0 mb-8 p-5 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <p
          className="font-bold text-zinc-900 dark:text-zinc-100 mb-2"
          style={{ fontFamily: currentFont?.fontFamily }}
        >
          Moonwave 메모
        </p>
        <p
          className="text-zinc-600 dark:text-zinc-400 leading-relaxed"
          style={{ fontFamily: currentFont?.fontFamily }}
        >
          가장 간편한 기록, Moonwave 메모
          <br />
          언제 어디서나 잊기 전에 작성하고
          <br />
          필요할 때 꺼내보세요
        </p>
        <div className="flex items-center gap-2 mt-3 text-sm text-zinc-400 dark:text-zinc-500">
          <span>내 메모 · 4.23.</span>
          <span>★</span>
        </div>
      </div>

      {/* Font Size Slider */}
      <div className="px-4 lg:px-0 mb-8">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">가</span>
          <div className="flex-1 relative">
            <input
              type="range"
              min={0}
              max={FONT_SIZES.length - 1}
              value={currentSizeIdx}
              onChange={(e) => {
                const idx = Number(e.target.value)
                setFontSize(FONT_SIZES[idx].id as FontSize)
              }}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
            />
            <div className="flex justify-between mt-1 px-0.5">
              {FONT_SIZES.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i <= currentSizeIdx ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                />
              ))}
            </div>
          </div>
          <span className="text-lg text-zinc-500 font-bold">가</span>
        </div>
      </div>

      {/* Font Family Selection */}
      <div className="px-4 lg:px-0">
        {FONT_FAMILIES.map((font) => (
          <button
            key={font.id}
            onClick={() => setFontFamily(font.id as FontFamily)}
            className="w-full flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <span
              className="font-medium text-zinc-900 dark:text-zinc-100"
              style={{ fontFamily: font.fontFamily }}
            >
              {font.name}
            </span>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                settings.fontFamily === font.id
                  ? 'border-zinc-900 dark:border-zinc-100'
                  : 'border-zinc-300 dark:border-zinc-600'
              }`}
            >
              {settings.fontFamily === font.id && (
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="h-20" />
    </div>
  )
}
