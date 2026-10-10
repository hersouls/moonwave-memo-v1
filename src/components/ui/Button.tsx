import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Button as KitButton, type ButtonVariant as KitVariant, type ButtonSize as KitSize } from '@/mw/Button'
import { IcLineLoading } from '@/mw/icons'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** 진행 중: 누를 수 없게 하고 돌아가는 표시를 앞에 붙여요 */
  loading?: boolean
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
}

// Memo가 써 온 이름 → 키트의 Button. 지우기 같은 결정도 키트에서는 Primary예요 (components/popup).
const VARIANT: Record<ButtonVariant, KitVariant> = {
  primary: 'primary',
  danger: 'primary',
  secondary: 'secondary',
  ghost: 'tertiary-subtle',
  text: 'tertiary-subtle',
}
const SIZE: Record<ButtonSize, KitSize> = { sm: 'small', md: 'medium', lg: 'large' }

/** 키트의 Button(mw-button)이에요. 모양은 키트가 정하고, 여기서는 진행 중 상태와 너비 채우기만 더해요. */
export function Button({ variant = 'primary', size = 'md', fullWidth, loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <KitButton
      variant={VARIANT[variant]}
      size={SIZE[size]}
      className={[fullWidth && 'w-full', className].filter(Boolean).join(' ') || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <IcLineLoading size={20} className="animate-spin" />}
      {children}
    </KitButton>
  )
}
