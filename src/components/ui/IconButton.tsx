import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

/** 아이콘 하나짜리 버튼이에요. 키트의 mw-icon-button(36px, 누르는 영역 44px)이에요. aria-label을 꼭 줘요. */
export function IconButton({ children, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button type={type} className={['mw-icon-button', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  )
}
