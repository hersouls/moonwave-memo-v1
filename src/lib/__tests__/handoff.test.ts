import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { DRIVE_RECEIVE, incomingRoute, localDay, open, packedFromDrive, seal, withoutTitleHeading } from '../handoff'

const base64Url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('handoff — Memo와 Drive가 주고받는 봉투', () => {
  it('싼 봉투를 풀면 같은 글이 나와요', async () => {
    const note = { title: '오사카 준비물', text: '# 오사카 준비물\n\n- 여권\n- 환전 3만 엔', date: '2026-10-03' }
    const { packed, cut } = await seal(note)
    expect(cut).toBe(false)
    expect(packed).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await open(packed)).toEqual({ v: 1, ...note })
  })

  it('Drive가 표준 deflate로 싼 봉투도 풀어요', async () => {
    const packed = base64Url(deflateRawSync(Buffer.from(JSON.stringify({ v: 1, title: '명세서', text: '본문', cut: true }))))
    expect(await open(packed)).toEqual({ v: 1, title: '명세서', text: '본문', cut: true })
  })

  it('주소에 다 들어가지 않는 글은 뒷부분을 빼고 알려요', async () => {
    // 압축이 잘 되지 않는 글: 줄마다 다른 숫자
    let text = ''
    for (let i = 0; text.length < 1_500_000; i++) text += `${Math.sin(i).toString(36)}${i}\n`
    const { packed, cut } = await seal({ title: '긴 글', text })
    expect(cut).toBe(true)
    expect(packed.length).toBeLessThanOrEqual(400_000)
    const opened = await open(packed)
    expect(opened.cut).toBe(true)
    expect(text.startsWith(opened.text)).toBe(true)
  })

  it('모양이 다른 것은 받지 않아요', async () => {
    const pack = (value: unknown) => base64Url(deflateRawSync(Buffer.from(JSON.stringify(value))))
    await expect(open('')).rejects.toThrow()
    await expect(open('not-a-note')).rejects.toThrow()
    await expect(open(pack({ v: 2, title: 't', text: 'x' }))).rejects.toThrow()
    await expect(open(pack({ v: 1, title: 't' }))).rejects.toThrow()
    await expect(open(pack('text'))).rejects.toThrow()
    // 형식이 다른 날짜는 버려요
    expect(await open(pack({ v: 1, title: 't', text: 'x', date: '어제' }))).toEqual({ v: 1, title: 't', text: 'x' })
  })

  it('작게 접힌 큰 덩어리는 풀다가 멈춰요', async () => {
    const bomb = base64Url(deflateRawSync(Buffer.from(JSON.stringify({ v: 1, title: 't', text: 'a'.repeat(3_000_000) }))))
    expect(bomb.length).toBeLessThan(400_000)
    await expect(open(bomb)).rejects.toThrow()
  })

  it('주소에서 Drive의 봉투를 알아봐요', () => {
    expect(packedFromDrive('#drive=abc_-123')).toBe('abc_-123')
    expect(packedFromDrive('#other=abc')).toBeNull()
    expect(packedFromDrive('')).toBeNull()
    expect(DRIVE_RECEIVE).toBe('https://drive.moonwave.kr/#/receive/')
  })

  it('글 첫 줄의 제목이 메모 제목과 같을 때만 그 줄을 빼요', () => {
    expect(withoutTitleHeading('# 오사카 준비물\n\n- 여권', '오사카 준비물')).toBe('- 여권')
    expect(withoutTitleHeading('# 오사카 준비물', ' 오사카 준비물 ')).toBe('')
    expect(withoutTitleHeading('# 다른 제목\n\n본문', '오사카 준비물')).toBe('# 다른 제목\n\n본문')
    expect(withoutTitleHeading('## 오사카 준비물\n본문', '오사카 준비물')).toBe('## 오사카 준비물\n본문')
    expect(withoutTitleHeading('본문만', '')).toBe('본문만')
  })

  it('열려 있는 앱이 다시 불리면 받는 화면으로 온 것만 따라가요', () => {
    const origin = 'https://memo.moonwave.kr'
    expect(incomingRoute(`${origin}/share-target#drive=abc`, origin)).toBe('/share-target#drive=abc')
    expect(incomingRoute(`${origin}/share-target?title=t&text=x`, origin)).toBe('/share-target?title=t&text=x')
    expect(incomingRoute(`${origin}/`, origin)).toBeNull()
    expect(incomingRoute(`${origin}/memo/3`, origin)).toBeNull()
    expect(incomingRoute('https://example.com/share-target#drive=abc', origin)).toBeNull()
    expect(incomingRoute('주소 아님', origin)).toBeNull()
    expect(incomingRoute(undefined, origin)).toBeNull()
  })

  it('시각을 그 기기의 날짜로 바꿔요', () => {
    const at = new Date(2026, 9, 3, 23, 30)
    expect(localDay(at.toISOString())).toBe('2026-10-03')
    expect(localDay('날짜 아님')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(localDay(undefined)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
