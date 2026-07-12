import { describe, it, expect } from 'vitest'
import { normalizePath, pathsOverlap } from '../pathOverlap'

describe('normalizePath', () => {
  it('unifies separators, trailing slashes and case', () => {
    expect(normalizePath('D:\\Memo\\Notes\\')).toBe('d:/memo/notes')
    expect(normalizePath('d:/memo/notes')).toBe('d:/memo/notes')
    expect(normalizePath('\\\\NAS\\share\\memo')).toBe('//nas/share/memo')
  })
})

describe('pathsOverlap (§4.6 미러 폴더 가드)', () => {
  it('detects the same folder despite separator/case/trailing-slash differences', () => {
    expect(pathsOverlap('D:\\Memo', 'D:\\Memo')).toBe(true)
    expect(pathsOverlap('D:\\Memo\\', 'd:/memo')).toBe(true)
    expect(pathsOverlap('\\\\NAS\\share', '//nas/share/')).toBe(true)
  })

  it('detects nesting in both directions', () => {
    expect(pathsOverlap('D:\\Memo', 'D:\\Memo\\backup')).toBe(true)
    expect(pathsOverlap('D:\\Memo\\backup', 'D:\\Memo')).toBe(true)
    expect(pathsOverlap('\\\\NAS\\share\\memo', '\\\\NAS\\share')).toBe(true)
  })

  it('does not flag siblings sharing a name prefix', () => {
    expect(pathsOverlap('D:\\Memo', 'D:\\Memo2')).toBe(false)
    expect(pathsOverlap('D:\\Memo\\notes', 'D:\\Memo\\notes-backup')).toBe(false)
  })

  it('does not flag unrelated folders', () => {
    expect(pathsOverlap('D:\\Memo', 'E:\\Backup')).toBe(false)
    expect(pathsOverlap('\\\\NAS\\share1', '\\\\NAS\\share2')).toBe(false)
  })
})
