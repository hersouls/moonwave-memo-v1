import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { IcFillHeart, IcLineChevronRight, IcLineHeart, IcLineInfo } from './icons'
import { TagCategory } from './Tag'

export type ListItemButtonVariant = 'text' | 'text-chevron' | 'chevron'
export type ListItemImageType = 'default' | 'multi' | 'product' | 'product-multi'
export type ListItemTitleType = 'default' | 'multi'

/** 썸네일 위에 얹는 하트 버튼 설정이에요. */
export type ListItemImageIconButtonOptions = {
  /** 켜진 상태예요. */
  active?: boolean
  /** 눌렀을 때 불러요. */
  onClick?: () => void
}

/** 텍스트 리스트 행의 오른쪽 버튼 설정이에요. */
export type ListTextItemButton = {
  /** 버튼에 보여 줄 값이에요. */
  text: string
  /** 버튼 모양이에요. 기본은 text예요. */
  variant?: ListItemButtonVariant
  /** 눌렀을 때 불러요. */
  onClick?: () => void
}

export type ListContainerProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 리스트 항목들이에요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 텍스트 리스트의 컨테이너예요. ListTextItem을 세로로 쌓아요. */
export function ListText({ className, children, ref, ...props }: ListContainerProps) {
  return (
    <div ref={ref} className={cx('mw-list', 'mw-list-text', className)} {...props}>
      {children}
    </div>
  )
}

export type ListItemHeadlineProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  /** 헤드라인 글자예요. 한 줄로 써요. */
  title: string
  /** 헤드라인 아래에 보여 줄 본문이에요. 한 줄을 넘으면 말줄임돼요. */
  body?: string
  /** 헤드라인 옆에 정보 아이콘을 보여 줘요. 기본은 false예요. */
  showIcon?: boolean
  /** 정보 아이콘을 눌렀을 때 불러요. */
  onIconClick?: () => void
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 행의 헤드라인, 본문, 정보 아이콘을 보여 줘요. */
export function ListItemHeadline({
  className,
  title,
  body,
  showIcon = false,
  onIconClick,
  ref,
  ...props
}: ListItemHeadlineProps) {
  return (
    <div ref={ref} className={cx('mw-list-headline', className)} {...props}>
      <div className="mw-list-headline__title-area">
        <span className="mw-list-headline__text">{title}</span>
        {showIcon && (
          <button type="button" className="mw-list-headline__icon" onClick={onIconClick} aria-label="정보">
            <IcLineInfo size={20} />
          </button>
        )}
      </div>
      {body && <span className="mw-list-headline__body">{body}</span>}
    </div>
  )
}

export type ListItemButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 버튼에 보여 줄 값이에요. chevron 모양에서는 보이지 않아요. */
  children: ReactNode
  /** 버튼 모양이에요. text는 값만, text-chevron은 값과 꺾쇠, chevron은 꺾쇠만 보여 줘요. 기본은 text예요. */
  variant?: ListItemButtonVariant
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 행의 오른쪽 끝에 놓는 버튼이에요. */
export function ListItemButton({ variant = 'text', className, children, ref, ...props }: ListItemButtonProps) {
  const showChevron = variant === 'text-chevron' || variant === 'chevron'
  const showText = variant === 'text' || variant === 'text-chevron'
  return (
    <button ref={ref} className={cx('mw-list-button', `mw-list-button--${variant}`, className)} {...props}>
      {showText && <span className="mw-list-button__text">{children}</span>}
      {showChevron && (
        <span className="mw-list-button__icon">
          <IcLineChevronRight size={20} />
        </span>
      )}
    </button>
  )
}

export type ListTextItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  /** 헤드라인 글자예요. */
  title: string
  /** 헤드라인 아래에 보여 줄 본문이에요. */
  body?: string
  /** 헤드라인 옆에 정보 아이콘을 보여 줘요. */
  showIcon?: boolean
  /** 정보 아이콘을 눌렀을 때 불러요. */
  onIconClick?: () => void
  /** 오른쪽 버튼 설정이에요. rightElement가 있으면 쓰지 않아요. */
  button?: ListTextItemButton
  /** 오른쪽에 놓을 요소예요. 스위치처럼 버튼이 아닌 것을 넣을 때 써요. */
  rightElement?: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 텍스트 리스트의 행이에요. 왼쪽에 헤드라인, 오른쪽에 버튼이나 스위치를 놓아요. */
export function ListTextItem({
  className,
  title,
  body,
  showIcon,
  onIconClick,
  button,
  rightElement,
  ref,
  ...props
}: ListTextItemProps) {
  return (
    <div ref={ref} className={cx('mw-list-item', 'mw-list-item--text', className)} {...props}>
      <ListItemHeadline title={title} body={body} showIcon={showIcon} onIconClick={onIconClick} />
      {rightElement ||
        (button && (
          <ListItemButton variant={button.variant} onClick={button.onClick}>
            {button.text}
          </ListItemButton>
        ))}
    </div>
  )
}

/** 로고 리스트의 컨테이너예요. ListLogoItem을 세로로 쌓아요. */
export function ListLogo({ className, children, ref, ...props }: ListContainerProps) {
  return (
    <div ref={ref} className={cx('mw-list', 'mw-list-logo', className)} {...props}>
      {children}
    </div>
  )
}

export type ListItemImageIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 켜진 상태예요. 켜지면 채움 하트를 보여 줘요. 기본은 false예요. */
  active?: boolean
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 썸네일 오른쪽 아래에 얹는 하트 버튼이에요. */
export function ListItemImageIconButton({ className, active = false, ref, ...props }: ListItemImageIconButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('mw-list-item-image-icon-button', className)}
      aria-label={active ? '좋아요 취소' : '좋아요'}
      {...props}
    >
      {active ? <IcFillHeart size={24} /> : <IcLineHeart size={24} />}
    </button>
  )
}

export type ListItemImageProps = HTMLAttributes<HTMLDivElement> & {
  /** 썸네일 크기와 모양이에요. default 64px, multi 128px, product 104px, product-multi 154px이고 기본은 default예요. */
  type?: ListItemImageType
  /** 사진 주소예요. 없으면 children을 보여 줘요. */
  src?: string
  /** 사진을 설명하는 대체 글이에요. */
  alt?: string
  /** 하트 버튼 설정이에요. 주면 썸네일 위에 버튼이 얹혀요. */
  iconButton?: ListItemImageIconButtonOptions
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 리스트 항목의 썸네일이에요. */
export function ListItemImage({
  type = 'default',
  className,
  src,
  alt,
  iconButton,
  children,
  ref,
  ...props
}: ListItemImageProps) {
  return (
    <div ref={ref} className={cx('mw-list-item-image', `mw-list-item-image--${type}`, className)} {...props}>
      {src ? <img src={src} alt={alt || ''} /> : children}
      {iconButton && <ListItemImageIconButton active={iconButton.active} onClick={iconButton.onClick} />}
    </div>
  )
}

export type ListItemTitleProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 굵게 보여 줄 본문이에요. 레이블 아래에 놓여요. */
  body?: string
  /** 본문 위에 작게 보여 줄 레이블이에요. */
  label?: string
  /** multi는 128px 너비에 맞춰요. */
  type?: ListItemTitleType
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 썸네일 옆이나 아래에 놓는 레이블과 본문이에요. */
export function ListItemTitle({ className, body, label, type, ref, ...props }: ListItemTitleProps) {
  return (
    <div ref={ref} className={cx('mw-list-title', type === 'multi' && 'mw-list-title--multi', className)} {...props}>
      {label && <div className="mw-list-title__label">{label}</div>}
      {body && <div className="mw-list-title__body">{body}</div>}
    </div>
  )
}

export type ListImageItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 사진 주소예요. */
  src: string
  /** 사진을 설명하는 대체 글이에요. */
  alt?: string
  /** 본문 위에 작게 보여 줄 레이블이에요. */
  label?: string
  /** 굵게 보여 줄 본문이에요. */
  body?: string
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 로고 리스트의 행이에요. 64px 원형 썸네일 옆에 레이블과 본문을 놓아요. */
export function ListLogoItem({ className, src, alt, label, body, ref, ...props }: ListImageItemProps) {
  return (
    <div ref={ref} className={cx('mw-list-item', 'mw-list-item--image', className)} {...props}>
      <ListItemImage type="default" src={src} alt={alt} />
      <ListItemTitle label={label} body={body} />
    </div>
  )
}

/** 이미지 리스트의 컨테이너예요. ListImageItem을 가로로 놓고 스크롤해요. */
export function ListImage({ className, children, ref, ...props }: ListContainerProps) {
  return (
    <div ref={ref} className={cx('mw-list', 'mw-list-image', className)} {...props}>
      {children}
    </div>
  )
}

/** 이미지 리스트의 항목이에요. 128px 정사각 사진 아래에 레이블과 본문을 놓아요. */
export function ListImageItem({ className, src, alt, label, body, ref, ...props }: ListImageItemProps) {
  return (
    <div ref={ref} className={cx('mw-list-item', 'mw-list-item--multi', className)} {...props}>
      <ListItemImage type="multi" src={src} alt={alt} />
      <ListItemTitle type="multi" label={label} body={body} />
    </div>
  )
}

/** 썸네일 리스트의 컨테이너예요. ListProductItem을 세로로 쌓아요. */
export function ListProduct({ className, children, ref, ...props }: ListContainerProps) {
  return (
    <div ref={ref} className={cx('mw-list', 'mw-list-product', className)} {...props}>
      {children}
    </div>
  )
}

export type ListProductItemTagsProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 태그 레이블들이에요. 비어 있으면 아무것도 그리지 않아요. */
  tags: string[]
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 항목 아래에 태그를 4px 간격으로 나란히 놓아요. */
export function ListProductItemTags({ className, tags, ref, ...props }: ListProductItemTagsProps) {
  if (!tags || tags.length === 0) return null
  return (
    <div ref={ref} className={cx('mw-list-product-tags', className)} {...props}>
      {tags.map((tag, index) => (
        <TagCategory key={index} type="basic" size="small">
          {tag}
        </TagCategory>
      ))}
    </div>
  )
}

export type ListItemProductTitleProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 항목 이름이에요. 한 줄을 넘으면 말줄임돼요. */
  body?: string
  /** 이름 위에 작게 보여 줄 레이블이에요. */
  label?: string
  /** 굵게 보여 줄 값이에요. 금액이나 개수를 넣어요. */
  price?: string
  /** 값 앞에 강조색으로 보여 줄 비율이에요. */
  discountRate?: string
  /** multi는 2열 그리드의 154px 너비에 맞춰요. */
  type?: ListItemTitleType
  /** 아래에 보여 줄 태그 레이블들이에요. */
  tags?: string[]
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 썸네일 리스트 항목의 레이블, 이름, 값, 태그를 보여 줘요. */
export function ListItemProductTitle({
  className,
  body,
  label,
  price,
  discountRate,
  type,
  tags,
  ref,
  ...props
}: ListItemProductTitleProps) {
  return (
    <div
      ref={ref}
      className={cx('mw-list-product-title', type === 'multi' && 'mw-list-product-title--multi', className)}
      {...props}
    >
      <div className="mw-list-product-title__product">
        <div className="mw-list-product-title__text">
          {label && <div className="mw-list-product-title__label">{label}</div>}
          {body && <div className="mw-list-product-title__body">{body}</div>}
        </div>
        {(price || discountRate) && (
          <div className="mw-list-product-title__price-area">
            {discountRate && <span className="mw-list-product-title__discount-rate">{discountRate}</span>}
            {price && <span className="mw-list-product-title__price">{price}</span>}
          </div>
        )}
      </div>
      {tags && tags.length > 0 && <ListProductItemTags tags={tags} />}
    </div>
  )
}

export type ListProductItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  /** 사진 주소예요. */
  src: string
  /** 사진을 설명하는 대체 글이에요. */
  alt?: string
  /** 이름 위에 작게 보여 줄 레이블이에요. */
  label?: string
  /** 항목 이름이에요. 한 줄을 넘으면 말줄임돼요. */
  title?: string
  /** 굵게 보여 줄 값이에요. 금액이나 개수를 넣어요. */
  price?: string
  /** 값 앞에 강조색으로 보여 줄 비율이에요. */
  discountRate?: string
  /** 아래에 보여 줄 태그 레이블들이에요. */
  tags?: string[]
  /** 하트 버튼 설정이에요. 주면 썸네일 위에 버튼이 얹혀요. */
  iconButton?: ListItemImageIconButtonOptions
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 썸네일 리스트의 행이에요. 104px 썸네일 옆에 레이블, 이름, 값, 태그를 놓아요. */
export function ListProductItem({
  className,
  src,
  alt,
  label,
  title,
  price,
  discountRate,
  tags,
  iconButton,
  ref,
  ...props
}: ListProductItemProps) {
  return (
    <div ref={ref} className={cx('mw-list-item', 'mw-list-item--product-image', className)} {...props}>
      <ListItemImage type="product" src={src} alt={alt} iconButton={iconButton} />
      <ListItemProductTitle label={label} body={title} price={price} discountRate={discountRate} tags={tags} />
    </div>
  )
}

/** 2열 그리드 리스트의 컨테이너예요. ListProductGridItem을 두 칸씩 놓아요. */
export function ListProductGrid({ className, children, style, ref, ...props }: ListContainerProps) {
  return (
    <div
      ref={ref}
      className={cx('mw-list', 'mw-list-product-grid', className)}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

/** 2열 그리드 리스트의 항목이에요. 154px 정사각 썸네일 아래에 레이블, 이름, 값, 태그를 놓아요. */
export function ListProductGridItem({
  className,
  src,
  alt,
  label,
  title,
  price,
  discountRate,
  tags,
  iconButton,
  ref,
  ...props
}: ListProductItemProps) {
  return (
    <div ref={ref} className={cx('mw-list-item', 'mw-list-item--product-multi', className)} {...props}>
      <ListItemImage type="product-multi" src={src} alt={alt} iconButton={iconButton} />
      <ListItemProductTitle
        type="multi"
        label={label}
        body={title}
        price={price}
        discountRate={discountRate}
        tags={tags}
      />
    </div>
  )
}
