import { format, parseISO } from 'date-fns'
import type { Folder } from '@/lib/types'

// 카테고리별 제목 규칙: [폴더명]_본문요약_YYMMDD  (예: [PPA]_법률검토_260712)
// - 폴더가 없는(folderId === null) 메모는 '미분류'로 표기
// - 요약은 규칙 기반(본문 앞부분)으로 즉시 생성하거나 AI로 다듬어 넣는다

export const UNFILED_LABEL = '미분류'
// 본문 요약 최대 길이: 띄어쓰기 포함 20자 이내
export const TITLE_SUMMARY_MAX = 20

/** createdAt(ISO) → YYMMDD */
export function formatTitleDate(dateISO: string): string {
  try {
    return format(parseISO(dateISO), 'yyMMdd')
  } catch {
    return format(new Date(), 'yyMMdd')
  }
}

/** folderId → 카테고리 라벨(폴더명 또는 '미분류') */
export function getCategoryLabel(folderId: number | null, folders: Folder[]): string {
  if (folderId == null) return UNFILED_LABEL
  return folders.find((f) => f.id === folderId)?.name?.trim() || UNFILED_LABEL
}

/** 제목에 넣기 안전하도록 요약 정리: 구분자('_')·대괄호·개행 제거 후 10자 컷 */
export function sanitizeSummary(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/[[\]_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_SUMMARY_MAX)
    .trim()
}

/** 규칙 기반 본문 요약(첫 유의미 줄에서 마크다운 제거 후 20자) */
export function summarizeBodyForTitle(body: string): string {
  const firstLine = body
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? ''
  const cleaned = firstLine
    // 선행 블록 마커: 제목(#)은 공백 선택, 목록/인용(- * + > 1.)은 뒤 공백 필수 —
    // '3.14', '-5도' 같은 실제 본문이 리스트 마커로 오인돼 잘리지 않도록
    .replace(/^(?:#{1,6}\s*|(?:[-*+>]|\d+\.)\s+)/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크·이미지 → 라벨 텍스트
    .replace(/[*_`~]/g, '') // 인라인 강조/코드 기호
  return sanitizeSummary(cleaned)
}

/** 파트 조합: 요약이 비면 [폴더]_YYMMDD 로 폴백 */
export function composeTitle(label: string, summary: string, dateStamp: string): string {
  const s = sanitizeSummary(summary)
  return s ? `[${label}]_${s}_${dateStamp}` : `[${label}]_${dateStamp}`
}

/** 규칙 기반 제목 전체 생성(즉시, AI 불필요) */
export function buildRuleTitle(
  params: { folderId: number | null; createdAt: string; body: string },
  folders: Folder[],
): string {
  const label = getCategoryLabel(params.folderId, folders)
  const summary = summarizeBodyForTitle(params.body)
  return composeTitle(label, summary, formatTitleDate(params.createdAt))
}
