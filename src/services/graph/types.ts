/* 지식 그래프 데이터 형태 — 워커와 화면이 같이 써요. */

/** 연결 신호: [[링크]] · 본문 언급 · 드문 태그 공유 · AI 의미 유사 */
export type LinkKind = 'wiki' | 'mention' | 'tag' | 'semantic'

/** 강한 신호부터 — 한 쌍에 여러 신호가 있으면 이 순서로 대표 종류를 정해요 */
export const KIND_ORDER: readonly LinkKind[] = ['wiki', 'mention', 'tag', 'semantic']

export interface GraphMemoInput {
  id: string
  title: string
  body: string
  tags: string[]
  /** 폴더 id(문자열) 또는 'none' */
  group: string
  updatedAt: string
}

export interface GraphNode {
  id: string
  label: string
  /** 폴더 id(문자열) 또는 'none' — 폴더 색 */
  group: string
  /** 주제 묶음 번호(커뮤니티). 혼자 떨어진 메모는 -1 */
  community: number
  /** 연결 수 — 노드 크기·허브 판별 */
  degree: number
  x: number
  y: number
}

export interface GraphLink {
  source: string
  target: string
  /** 대표 신호 (KIND_ORDER에서 가장 앞선 것) */
  kind: LinkKind
  /** 이 쌍을 잇는 모든 신호 */
  kinds: LinkKind[]
  /** 굵기·당기는 힘 */
  weight: number
  /** AI 의미 유사도 0..1 (semantic 신호가 있을 때) */
  sim?: number
}

export interface Community {
  id: number
  size: number
  /** 제목에서 뽑은 대표 낱말 1~2개 */
  label: string
}

export interface GraphResult {
  nodes: GraphNode[]
  links: GraphLink[]
  /** 폴더 id — 노드 수 내림차순 (색·범례 순서) */
  groups: string[]
  /** 크기 내림차순, 두 개 이상 모인 묶음만 */
  communities: Community[]
  /** 전체 메모 수 (상한 적용 전) */
  total: number
  /** 상한(MAX_NODES)을 넘어 최근 메모만 담았는지 */
  truncated: boolean
  /** 계산에 걸린 시간(ms) */
  ms: number
}

export interface GraphRequest {
  seq: number
  memos: GraphMemoInput[]
  /** 메모 id → 정규화 전 임베딩 */
  vectors: Array<[string, Float32Array]>
  /** 메모 id → 직전 자리 (레이아웃을 이어받아 화면이 튀지 않게) */
  prev: Array<[string, number, number]>
}

export interface GraphResponse {
  seq: number
  result?: GraphResult
  error?: string
}
