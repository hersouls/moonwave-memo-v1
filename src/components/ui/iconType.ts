import type { ReactNode } from 'react'
import type { IconProps } from '@/mw/icons'

/** 키트의 아이콘 컴포넌트(@/mw/icons)를 값으로 넘길 때의 타입이에요. */
export type IconType = (props: IconProps) => ReactNode
