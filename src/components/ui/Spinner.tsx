import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** 스크린 리더 안내 문구. 장식 용도로만 쓸 때는 빈 문자열 전달 */
  label?: string
}

const spinnerSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
}

/** 로딩 스피너 — Loader2 + animate-spin 조합의 공용 프리미티브 */
export function Spinner({ size = 'md', className, label = '로딩 중' }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center justify-center">
      <Loader2 aria-hidden className={clsx('animate-spin', spinnerSizes[size], className)} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
