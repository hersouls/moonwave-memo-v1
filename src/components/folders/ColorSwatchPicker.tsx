import { Check } from 'lucide-react'
import clsx from 'clsx'
import { FOLDER_COLORS, FOLDER_COLOR_NAMES } from '@/utils/constants'

interface ColorSwatchPickerProps {
  value: string
  onChange: (color: string) => void
  colors?: readonly string[]
  className?: string
}

/**
 * 공유 색상 스와치 피커 — 폴더/템플릿 색상 선택에 사용.
 * 선택 상태는 링 대신 체크 아이콘 + 스케일로 표시(다크모드 흰 halo 방지),
 * 한국어 색상명 aria-label과 aria-pressed로 보조기기에 상태를 노출한다.
 */
export function ColorSwatchPicker({
  value,
  onChange,
  colors = FOLDER_COLORS,
  className,
}: ColorSwatchPickerProps) {
  return (
    <div role="group" aria-label="색상 선택" className={clsx('flex flex-wrap gap-2', className)}>
      {colors.map((c) => {
        const isSelected = value === c
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={FOLDER_COLOR_NAMES[c] ?? c}
            aria-pressed={isSelected}
            className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'transition-transform duration-150 ease-standard hover:scale-110 active:scale-95',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
              isSelected && 'scale-110'
            )}
            style={{ backgroundColor: c }}
          >
            {isSelected && <Check className="w-4 h-4 text-white drop-shadow-sm" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
