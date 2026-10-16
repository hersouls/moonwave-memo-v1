import { describe, expect, it } from 'vitest'
import { memoToPlainText, memoToText } from '../share'

describe('memoToText', () => {
  it('제목과 본문을 빈 줄로 이어요', () => {
    expect(memoToText(' 제목 ', '본문\n둘째 줄')).toBe('제목\n\n본문\n둘째 줄')
  })
  it('비어 있으면 빈 글이에요', () => {
    expect(memoToText('  ', '')).toBe('')
  })
})

describe('memoToPlainText', () => {
  it('마크다운 기호를 걷어내고 줄바꿈은 지켜요', () => {
    const out = memoToPlainText('제목', '## 소제목\n**굵게** [링크](http://a.b)\n- 항목\n- [x] 할 일\n![사진](memo-image:3)')
    expect(out).toBe('제목\n\n소제목\n굵게 링크\n· 항목\n할 일\n[이미지]')
  })
})
