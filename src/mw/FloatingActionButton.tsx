import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type FloatingActionButtonVariant = 'fab' | 'extended' | 'inverse'

export type FloatingActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 버튼 종류예요. fab은 아이콘만, extended는 아이콘과 레이블, inverse는 색을 뒤집은 아이콘 버튼이에요. 기본은 fab이에요. */
  variant?: FloatingActionButtonVariant
  /** 버튼 내용이에요. 아이콘만 넣거나 아이콘 뒤에 레이블을 넣어요. */
  children: ReactNode
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 화면 위에 떠서 가장 중요한 행동을 강조하는 버튼이에요. */
export function FloatingActionButton({ variant = 'fab', className, children, ref, ...props }: FloatingActionButtonProps) {
  return (
    <button ref={ref} type="button" className={cx('mw-fab', `mw-fab--${variant}`, className)} {...props}>
      {children}
    </button>
  )
}

export type FloatingActionButtonMenuProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 메뉴 항목이에요. FloatingActionButtonMenuItem을 넣어요. */
  children: ReactNode
  /** 메뉴가 열려 있는지 알려 줘요. 기본은 false예요. */
  open?: boolean
  /** 아래쪽 FAB에 넣을 닫기 아이콘이에요. 닫혀 있을 때는 45도 돌아가 더하기처럼 보여요. */
  closeIcon: ReactNode
  /** 아래쪽 FAB을 누르면 불러요. 여기서 open을 바꿔요. */
  onClose: () => void
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** FAB 위로 메뉴 항목을 세로로 펼치는 컨테이너예요. 열고 닫는 FAB을 함께 그려요. */
export function FloatingActionButtonMenu({
  className,
  children,
  open = false,
  closeIcon,
  onClose,
  ref,
  ...props
}: FloatingActionButtonMenuProps) {
  return (
    <div ref={ref} className={cx('mw-fab-menu-wrapper', className)} {...props}>
      <div className={cx('mw-fab-menu', open && 'mw-fab-menu--open')} inert={!open}>
        {children}
      </div>
      <FloatingActionButton
        variant="fab"
        onClick={onClose}
        aria-expanded={open}
        style={{
          transform: open ? 'rotate(0deg)' : 'rotate(45deg)',
          transition: 'transform var(--motion-duration-medium) var(--motion-easing-ease-out)',
        }}
      >
        {closeIcon}
      </FloatingActionButton>
    </div>
  )
}

export type FloatingActionButtonMenuItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onClick'> & {
  /** 버튼 왼쪽에 보이는 레이블이에요. 버튼의 이름으로도 읽어 줘요. */
  label: string
  /** 버튼에 넣을 아이콘이에요. */
  icon: ReactNode
  /** 항목 버튼을 누르면 불러요. */
  onClick?: () => void
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** FAB 메뉴의 한 줄이에요. 레이블과 둥근 아이콘 버튼을 나란히 보여 줘요. */
export function FloatingActionButtonMenuItem({
  label,
  icon,
  onClick,
  className,
  ref,
  ...props
}: FloatingActionButtonMenuItemProps) {
  return (
    <div ref={ref} className={cx('mw-fab-menu-item', className)} {...props}>
      <span className="mw-fab-menu-item__label">{label}</span>
      <button type="button" className="mw-fab-menu-item__button" aria-label={label} onClick={onClick}>
        {icon}
      </button>
    </div>
  )
}
