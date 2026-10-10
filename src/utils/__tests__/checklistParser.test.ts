import { describe, it, expect } from 'vitest'
import { taskLineIndexes, toggleChecklistItem } from '../checklistParser'

const BODY = [
  '# 장보기',            // 0
  '- [ ] 우유',          // 1
  '- [x] 두부',          // 2
  '```',                 // 3
  '- [ ] 코드 안의 줄',   // 4
  '```',                 // 5
  '* [ ] 별표 목록',      // 6
  '1. [x] 번호 목록',     // 7
  '- 그냥 목록',          // 8
  '> - [ ] 인용 안의 일', // 9
].join('\n')

describe('taskLineIndexes', () => {
  it('화면에 체크로 그려지는 줄만, 그려지는 순서대로 돌려준다', () => {
    expect(taskLineIndexes(BODY)).toEqual([1, 2, 6, 7, 9])
  })

  it('할 일이 없으면 빈 배열', () => {
    expect(taskLineIndexes('메모\n- 목록')).toEqual([])
  })
})

describe('toggleChecklistItem', () => {
  const line = (body: string, index: number) => body.split('\n')[index]

  it('누른 줄만 뒤집는다', () => {
    const next = toggleChecklistItem(BODY, 1)
    expect(line(next, 1)).toBe('- [x] 우유')
    expect(line(next, 2)).toBe('- [x] 두부')
    expect(line(toggleChecklistItem(BODY, 2), 2)).toBe('- [ ] 두부')
  })

  it('-가 아닌 목록 표시의 할 일도 뒤집는다', () => {
    expect(line(toggleChecklistItem(BODY, 6), 6)).toBe('* [x] 별표 목록')
    expect(line(toggleChecklistItem(BODY, 7), 7)).toBe('1. [ ] 번호 목록')
  })

  it('인용 안의 할 일을 뒤집는다', () => {
    expect(line(toggleChecklistItem(BODY, 9), 9)).toBe('> - [x] 인용 안의 일')
  })

  it('할 일이 아닌 줄과 범위를 벗어난 줄은 그대로 둔다', () => {
    expect(toggleChecklistItem(BODY, 8)).toBe(BODY)
    expect(toggleChecklistItem(BODY, 99)).toBe(BODY)
  })
})
