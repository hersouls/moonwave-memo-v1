/** 지식 그래프 묶음 색 — 폴더 고유색이 없을 때와 주제 색에 써요 (키트의 분류 색 8가지) */
export const GROUP_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--mw-cat-${n})`)
/** 묶음에 들지 않은 것 */
export const NONE_COLOR = 'var(--mw-cat-other)'
