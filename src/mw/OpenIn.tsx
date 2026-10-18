/* Moonwave UX — OpenIn (서비스 간 열기: 다른 Moonwave 서비스의 화면을 여는 링크와 메뉴)
   갈 곳이 하나면 OpenInLink, 둘 이상이면 OpenIn 메뉴, 항목에 이미 ⋯ 메뉴가 있으면 openInActions()를 그 메뉴의 끝에 넣어요.
   주소는 open-in.ts의 openIn()이 Admin 기록의 표로 만들어요. 이 부품은 주소(href)를 받지 않아서 Moonwave 밖으로는 열지 않아요.
   규격: https://ux.moonwave.kr/patterns/open-in */
import { useRef, useState } from 'react'
import type { ComponentType, MouseEventHandler } from 'react'
import { ActionMenu } from './ActionMenu'
import type { ItemAction } from './ActionMenu'
import { Button } from './Button'
import { cx } from './cx'
import {
  IcLineBook, IcLineCalendar, IcLineExternalLink, IcLineGallery, IcLineMail, IcLineNewChat,
  IcMwCar, IcMwChart, IcMwDrive, IcMwHeartPulse, IcMwMap, IcMwMusic, IcMwNote, IcMwPlane, IcMwWallet,
} from './icons'
import type { IconProps } from './icons'
import { openHref, openLabel } from './open-in'
import type { OpenTarget } from './open-in'

export { openIn, openHref, openLabel, openServiceOf } from './open-in'
export type { OpenParams, OpenRoute, OpenService, OpenTarget } from './open-in'

// 서비스마다 같은 아이콘이에요. 키트에 그 서비스의 아이콘이 없으면 바깥으로 여는 표시예요.
const ICON: Record<string, ComponentType<IconProps>> = {
  asset: IcMwWallet, auto: IcMwCar, blog: IcLineBook, bot: IcLineNewChat, calendar: IcLineCalendar, drive: IcMwDrive,
  health: IcMwHeartPulse, mail: IcLineMail, mca: IcMwChart, memo: IcMwNote, music: IcMwMusic, photo: IcLineGallery,
  position: IcMwMap, trip: IcMwPlane,
}
const iconOf = (to: string) => ICON[to] ?? IcLineExternalLink

/** ⋯ 메뉴(ActionMenu)의 끝에 넣을 줄이에요. 열 수 없는 곳은 빠져요. 줄은 링크라서 새 탭(폰에서는 그 서비스의 앱)으로 열려요. */
export function openInActions(targets: readonly OpenTarget[]): ItemAction[] {
  return targets.flatMap((t) => {
    const href = openHref(t)
    return href ? [{ label: openLabel(t), icon: iconOf(t.to), href, run: () => {} }] : []
  })
}

export type OpenInLinkProps = OpenTarget & {
  className?: string
  /** 누른 뒤 할 일이에요(시트 닫기 등). 이동은 링크가 해요. */
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

/** 갈 곳이 하나일 때의 링크예요: `Drive에서 열기`. 열 수 없으면(쉬는 서비스, 맞지 않는 값) 아무것도 그리지 않아요. */
export function OpenInLink({ className, onClick, ...rest }: OpenInLinkProps) {
  const t = rest as OpenTarget
  const href = openHref(t)
  if (!href) return null
  const Icon = iconOf(t.to)
  return (
    <a className={cx('mw-open-in', className)} href={href} target="_blank" rel="noopener noreferrer" data-open-in={`${t.to}:${t.route}`} onClick={onClick}>
      <Icon size={20} />
      <span>{openLabel(t)}</span>
      <span className="mw-sr-only">(새 탭)</span>
    </a>
  )
}

export type OpenInProps = {
  /** 갈 곳들이에요. 열 수 없는 곳은 그 줄만 빠지고, 하나만 남으면 링크 하나가 돼요. 모두 빠지면 아무것도 그리지 않아요. */
  targets: readonly OpenTarget[]
  /** 메뉴를 여는 버튼의 이름이에요. 기본은 `다른 서비스에서 열기`예요. */
  label?: string
  className?: string
}

/** 갈 곳이 둘 이상일 때의 메뉴예요. 폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 버튼 아래의 메뉴예요(ActionMenu). */
export function OpenIn({ targets, label = '다른 서비스에서 열기', className }: OpenInProps) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const live = targets.filter((t) => openHref(t))
  if (live.length === 0) return null
  if (live.length === 1) return <OpenInLink {...live[0]} className={className} />
  return (
    <>
      <Button ref={button} variant="tertiary" size="medium" className={cx('mw-open-in__button', className)}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <IcLineExternalLink size={20} />{label}
      </Button>
      <ActionMenu open={open} onClose={() => setOpen(false)} label={label} actions={openInActions(live)} anchor={button.current} />
    </>
  )
}
