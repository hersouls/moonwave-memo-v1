import { describe, it, expect } from 'vitest'
import { markdownToSafeHtml } from '../markdownHtml'

describe('markdownToSafeHtml — formatting', () => {
  it('renders headings, emphasis, and inline code', () => {
    const html = markdownToSafeHtml('# Title\n\n**bold** and *em* and `code`')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<code>code</code>')
  })

  it('renders GFM tables', () => {
    const html = markdownToSafeHtml('| a | b |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })

  it('renders links and nested lists', () => {
    const html = markdownToSafeHtml('- one\n  - nested\n\n[site](https://example.com)')
    expect(html).toContain('<ul>')
    expect(html).toContain('<a href="https://example.com">site</a>')
  })

  it('preserves task-list checked state', () => {
    const html = markdownToSafeHtml('- [x] done\n- [ ] todo')
    expect(html).toContain('type="checkbox"')
    expect(html).toMatch(/checked/)
  })

  it('preserves the app-internal memo-image: scheme', () => {
    const html = markdownToSafeHtml('![pic](memo-image:5)')
    expect(html).toContain('src="memo-image:5"')
  })

  it('keeps inline base64 data: images', () => {
    const html = markdownToSafeHtml('![x](data:image/png;base64,AAAA)')
    expect(html).toContain('data:image/png;base64,AAAA')
  })
})

describe('markdownToSafeHtml — XSS payloads must be neutralized (§8 완료 기준)', () => {
  it('strips <script> tags', () => {
    const html = markdownToSafeHtml('hi\n\n<script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)</script')
  })

  it('strips img onerror handlers', () => {
    const html = markdownToSafeHtml('<img src="x" onerror="alert(1)">')
    expect(html).not.toContain('onerror')
  })

  it('strips svg onload (svg not allowed)', () => {
    const html = markdownToSafeHtml('<svg onload="alert(1)"></svg>')
    expect(html).not.toContain('onload')
    expect(html).not.toContain('<svg')
  })

  it('drops javascript: hrefs on links', () => {
    const html = markdownToSafeHtml('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('drops javascript: in raw anchor html', () => {
    const html = markdownToSafeHtml('<a href="javascript:alert(1)">x</a>')
    expect(html).not.toContain('javascript:')
  })

  it('strips iframes (incl. data: iframe)', () => {
    const html = markdownToSafeHtml('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>')
    expect(html).not.toContain('<iframe')
  })

  it('strips inline event handlers on arbitrary elements', () => {
    const html = markdownToSafeHtml('<div onclick="alert(1)">x</div>')
    expect(html).not.toContain('onclick')
  })
})
