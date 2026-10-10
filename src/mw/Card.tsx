import { Children, cloneElement, isValidElement } from 'react'
import type { HTMLAttributes, ImgHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type CardType = 'fullImage' | 'imageText'
export type CardSize = 'large' | 'medium'

const cardTypeClass: Record<CardType, string> = {
  fullImage: 'mw-card--full-image',
  imageText: 'mw-card--image-text',
}

export type CardTitleProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  /** 카드 유형이에요. fullImage는 title과 body를, imageText는 subtitle과 title을 보여 줘요. 기본은 fullImage예요. */
  type?: CardType
  /** 제목이에요. 한 줄로 써요. */
  title: ReactNode
  /** 본문이에요. fullImage 유형에서 제목 아래에 보여요. */
  body?: ReactNode
  /** 카테고리 같은 보조 제목이에요. imageText 유형에서 제목 위에 보여요. */
  subtitle?: ReactNode
  /** 버튼처럼 제목 아래에 덧붙일 내용이에요. */
  children?: ReactNode
  /** 글자 크기 단계예요. Card 안에서는 Card의 size를 따라요. 기본은 large예요. */
  size?: CardSize
  /** 어두운 사진 위에서 글자를 흰색으로 바꿔요. 기본은 false예요. */
  onDark?: boolean
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 카드의 제목 영역이에요. Card 안에 넣어 써요. */
export function CardTitle({
  size,
  onDark,
  type = 'fullImage',
  className,
  title,
  body,
  subtitle,
  children,
  ref,
  ...props
}: CardTitleProps) {
  const isImageText = type === 'imageText'
  return (
    <div
      ref={ref}
      className={cx(
        'mw-card-title',
        `mw-card-title--${size ?? 'large'}`,
        onDark && 'mw-card-title--on-dark',
        isImageText && 'mw-card-title--image-text',
        className,
      )}
      {...props}
    >
      {isImageText ? (
        <>
          {subtitle && <div className="mw-card-title__subtitle">{subtitle}</div>}
          <div className="mw-card-title__title">{title}</div>
          {children}
        </>
      ) : (
        <>
          <div className="mw-card-title__title">{title}</div>
          {body && <div className="mw-card-title__body">{body}</div>}
          {children}
        </>
      )}
    </div>
  )
}

export type CardProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 카드 유형이에요. fullImage는 사진 위에 제목을 겹치고 imageText는 사진 아래에 제목을 둬요. 기본은 fullImage예요. */
  type?: CardType
  /** 카드 크기예요. large는 320px, medium은 240px 정사각이에요. 기본은 large예요. */
  size?: CardSize
  /** CardTitle 글자를 흰색으로 바꿔요. 어두운 사진을 쓰는 fullImage 유형에서 써요. */
  onDark?: boolean
  /** CardImage와 CardTitle을 넣어요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 사진과 글을 한 덩어리로 묶는 카드예요. 안에 든 CardTitle에 유형과 크기를 내려 줘요. */
export function Card({ type, size, onDark, className, children, ref, ...props }: CardProps) {
  const enhancedChildren = Children.map(children, (child) => {
    if (isValidElement<CardTitleProps>(child) && child.type === CardTitle) {
      return cloneElement(child, {
        ...child.props,
        size: child.props.size || size,
        onDark: child.props.onDark !== undefined ? child.props.onDark : onDark,
        type: child.props.type || type,
      })
    }
    return child
  })

  return (
    <div
      ref={ref}
      className={cx('mw-card', cardTypeClass[type ?? 'fullImage'], `mw-card--${size ?? 'large'}`, className)}
      {...props}
    >
      {enhancedChildren}
    </div>
  )
}

export type CardImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  /** 사진 주소예요. */
  src: string
  /** 사진을 설명하는 대체 글이에요. */
  alt: string
  /** img 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLImageElement>
}

/** 카드의 사진이에요. 카드 크기에 맞춰 꽉 채워요. */
export function CardImage({ className, src, alt, ref, ...props }: CardImageProps) {
  return <img ref={ref} className={cx('mw-card-image', className)} src={src} alt={alt} {...props} />
}
