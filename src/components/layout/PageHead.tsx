/* 페이지 머리: 제목(h1)과 한 줄 설명, 오른쪽에 행동. 키트의 mw-page__head 그대로예요.
   규격: https://ux.moonwave.kr/patterns/app-shell#page */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/mw/Button'
import { IcLineCamera, IcLineDocumentAlt, IcLineMic, IcLineWrite } from '@/mw/icons'

export function PageHead({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mw-page__head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="mw-page__actions">{actions}</div>}
    </div>
  )
}

/**
 * 넓은 화면의 주 행동(새 메모)과 다른 방법으로 만들기(음성 · 사진 · 템플릿).
 * 900px 이하에서는 감추고, 같은 행동을 하단 탭 위의 FAB과 더보기 시트가 맡아요.
 */
export function CreateActions() {
  const navigate = useNavigate()
  const ui = useUIStore.getState
  return (
    <>
      <button type="button" className="mw-icon-button mw-wide-only" onClick={() => ui().openVoiceModal()} aria-label="음성 메모" title="음성 메모"><IcLineMic size={20} /></button>
      <button type="button" className="mw-icon-button mw-wide-only" onClick={() => ui().openImageOCRModal()} aria-label="사진에서 글자" title="사진에서 글자"><IcLineCamera size={20} /></button>
      <button type="button" className="mw-icon-button mw-wide-only" onClick={() => ui().openTemplateModal()} aria-label="템플릿으로 쓰기" title="템플릿으로 쓰기"><IcLineDocumentAlt size={20} /></button>
      <Button variant="primary" size="medium" className="mw-wide-only" onClick={() => navigate('/memo/new')}><IcLineWrite size={20} />새 메모</Button>
    </>
  )
}
