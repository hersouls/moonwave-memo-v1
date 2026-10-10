/** 키트의 아이콘 목록에 없는 뜻(굵게, 기울임, 취소선, 제목)은 그림을 그리지 않고 글자로 보여요.
    뜻이 다른 아이콘을 빌려 쓰지 않아요 (https://ux.moonwave.kr/foundations/iconography#meaning). */
const GLYPH = { bold: 'B', italic: 'I', strike: 'S', heading: 'H' } as const

export function FormatGlyph({ kind }: { kind: keyof typeof GLYPH }) {
  return <span className={`memo-glyph memo-glyph--${kind}`} aria-hidden="true">{GLYPH[kind]}</span>
}
