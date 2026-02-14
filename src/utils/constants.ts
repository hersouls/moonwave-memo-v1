import type { MemoColor } from '@/lib/types'

export const DEFAULT_FOLDERS = [
  { name: '내 메모', color: '#F59E0B', isDefault: true, isSystem: false },
  { name: '스크랩', color: '#84CC16', isDefault: false, isSystem: false },
  { name: '아이디어', color: '#22C55E', isDefault: false, isSystem: false },
  { name: '쇼핑', color: '#06B6D4', isDefault: false, isSystem: false },
] as const

export const SYSTEM_FOLDERS = [
  { name: '삭제된 메모', color: '#A1A1AA', isDefault: false, isSystem: true },
] as const

export const MEMO_COLORS: Record<MemoColor, string> = {
  white: '#FFFFFF',
  yellow: '#FEF3C7',
  green: '#DCFCE7',
  blue: '#DBEAFE',
  pink: '#FCE7F3',
  purple: '#F3E8FF',
}

export const FONT_FAMILIES = [
  { id: 'nanum-square' as const, name: '나눔스퀘어', fontFamily: "'NanumSquare', sans-serif" },
  { id: 'nanum-square-neo' as const, name: '나눔스퀘어 네오', fontFamily: "'NanumSquareNeo', sans-serif" },
  { id: 'nanum-square-round' as const, name: '나눔스퀘어 라운드', fontFamily: "'NanumSquareRound', sans-serif" },
  { id: 'nanum-barun-pen' as const, name: '나눔바른펜', fontFamily: "'NanumBarunpen', sans-serif" },
  { id: 'maruburi' as const, name: '마루부리', fontFamily: "'MaruBuri', serif" },
  { id: 'pretendard' as const, name: '기본 글꼴', fontFamily: "'Pretendard', sans-serif" },
] as const

export const FONT_SIZES = [
  { id: 'xs' as const, label: '매우 작게', scale: 0.8 },
  { id: 'sm' as const, label: '작게', scale: 0.9 },
  { id: 'md' as const, label: '보통', scale: 1.0 },
  { id: 'lg' as const, label: '크게', scale: 1.1 },
  { id: 'xl' as const, label: '매우 크게', scale: 1.2 },
  { id: 'xxl' as const, label: '최대', scale: 1.35 },
] as const

export const BACKUP_CONFIG = {
  CURRENT_VERSION: '1.0.0',
  APP_NAME: 'Memo',
  FILE_PREFIX: 'Memo_Backup',
} as const
