import { describe, expect, it } from 'vitest'
import { buildAutomaton, findPatterns, mergeEdges, semanticEdges, textEdges, TAG_MAX_GROUP } from '../edges'
import { louvain, rankCommunities, titleTokens } from '../community'
import { computeGraph } from '../compute'
import type { GraphMemoInput } from '../types'

const memo = (id: string, title: string, body = '', tags: string[] = [], group = 'none'): GraphMemoInput => ({
  id,
  title,
  body,
  tags,
  group,
  updatedAt: `2026-11-${String(10 + Number(id)).padStart(2, '0')}T00:00:00.000Z`,
})

const pairs = (links: Array<{ source: string; target: string }>) => links.map((l) => `${l.source}~${l.target}`).sort()

describe('아호-코라식', () => {
  it('겹치고 포함되는 패턴을 모두 찾아요', () => {
    const ac = buildAutomaton(['전력시장', '시장', '청정수소발전', '수소'])
    const found = findPatterns(ac, '2026년 청정수소발전 입찰시장 운영방안')
    expect([...found].sort()).toEqual([1, 2, 3])
  })
  it('없는 패턴은 찾지 않아요', () => {
    const ac = buildAutomaton(['abcd', 'bcx'])
    expect([...findPatterns(ac, 'abcabcabd')]).toEqual([])
    expect([...findPatterns(ac, 'zabcdz')]).toEqual([0])
  })
})

describe('글 신호', () => {
  it('[[링크]] · 본문 언급 · 드문 태그로 잇고, 대표 종류는 강한 것부터예요', () => {
    const links = textEdges([
      memo('1', '전력시장 제도개편', '[[ESS 활용 방향]] 참고'),
      memo('2', 'ESS 활용 방향', '전력시장 제도개편 이야기'),
      memo('3', '청정수소 입찰', '', ['수소']),
      memo('4', '수소 혼소 발전', '', ['수소']),
      memo('5', '짧음', 'ESS'),
    ])
    expect(pairs(links)).toEqual(['1~2', '3~4'])
    const l12 = links.find((l) => l.source === '1')!
    expect(l12.kind).toBe('wiki')
    expect(l12.kinds).toEqual(['wiki', 'mention'])
    expect(links.find((l) => l.source === '3')!.kind).toBe('tag')
  })
  it('제목 일부만 같은 별칭 링크 [[제목|별칭]]도 이어요', () => {
    const links = textEdges([memo('1', 'A 메모', '[[B 메모|비]]'), memo('2', 'B 메모')])
    expect(pairs(links)).toEqual(['1~2'])
  })
  it('너무 흔한 태그는 연결로 치지 않아요', () => {
    const many = Array.from({ length: TAG_MAX_GROUP + 1 }, (_, i) => memo(String(i + 1), `메모 ${i + 1}`, '', ['흔함']))
    expect(textEdges(many)).toEqual([])
  })
})

describe('의미 신호', () => {
  it('비슷한 벡터만 잇고 유사도를 기록해요', () => {
    const v = (...xs: number[]) => Float32Array.from(xs)
    const s = semanticEdges([
      ['1', v(1, 0, 0)],
      ['2', v(0.9, 0.1, 0)],
      ['3', v(0, 0, 1)],
    ])
    expect(s.map((e) => `${e.a}~${e.b}`)).toEqual(['1~2'])
    expect(s[0].sim).toBeGreaterThan(0.95)
  })
  it('글 신호와 합치면 한 쌍에 연결 하나예요', () => {
    const merged = mergeEdges(textEdges([memo('1', '가나다라', '마바사아'), memo('2', '마바사아')]), [{ a: '1', b: '2', sim: 0.8 }])
    expect(merged).toHaveLength(1)
    expect(merged[0].kinds).toEqual(['mention', 'semantic'])
    expect(merged[0].sim).toBe(0.8)
  })
})

describe('주제 묶음', () => {
  it('촘촘한 두 덩어리를 둘로 나눠요', () => {
    const ids = ['a', 'b', 'c', 'd', 'x', 'y', 'z', 'w', 'solo']
    const e = (s: string, t: string, weight = 1) => ({ source: s, target: t, weight })
    const edges = [
      e('a', 'b'), e('a', 'c'), e('a', 'd'), e('b', 'c'), e('b', 'd'), e('c', 'd'),
      e('x', 'y'), e('x', 'z'), e('x', 'w'), e('y', 'z'), e('y', 'w'), e('z', 'w'),
      e('d', 'x', 0.2),
    ]
    const m = louvain(ids, edges)
    expect(new Set([m[0], m[1], m[2], m[3]]).size).toBe(1)
    expect(new Set([m[4], m[5], m[6], m[7]]).size).toBe(1)
    expect(m[0]).not.toBe(m[4])
    const { community, communities } = rankCommunities(m, ['전력 a', '전력 b', '전력 c', '전력 d', '수소 x', '수소 y', '수소 z', '수소 w', '혼자'])
    expect(communities).toHaveLength(2)
    expect(community[8]).toBe(-1)
    expect(communities.map((c) => c.label).sort()).toEqual(['수소', '전력'])
  })
  it('제목 낱말에서 날짜 숫자와 한 글자는 빼요', () => {
    expect(titleTokens('[회사]_전력시장 제도개편 방향_261110')).toEqual(['회사', '전력시장', '제도개편', '방향'])
  })
})

describe('한 번 계산', () => {
  it('노드마다 자리 · 연결 수 · 묶음이 있어요', () => {
    const res = computeGraph({
      seq: 1,
      memos: [memo('1', '전력시장 제도개편', '[[ESS 활용 방향]]'), memo('2', 'ESS 활용 방향'), memo('3', '외딴 메모')],
      vectors: [],
      prev: [],
    })
    expect(res.nodes).toHaveLength(3)
    expect(res.links).toHaveLength(1)
    for (const n of res.nodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
    expect(res.nodes.find((n) => n.id === '3')!.degree).toBe(0)
    expect(res.truncated).toBe(false)
  })
  it('이전 자리를 이어받으면 크게 움직이지 않아요', () => {
    const memos = [memo('1', '가나다라', '[[마바사아]]'), memo('2', '마바사아'), memo('3', '자차카타', '[[마바사아]]')]
    const first = computeGraph({ seq: 1, memos, vectors: [], prev: [] })
    const second = computeGraph({ seq: 2, memos, vectors: [], prev: first.nodes.map((n) => [n.id, n.x, n.y]) })
    for (const n of second.nodes) {
      const p = first.nodes.find((f) => f.id === n.id)!
      expect(Math.hypot(n.x - p.x, n.y - p.y)).toBeLessThan(60)
    }
  })
})
