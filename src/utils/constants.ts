import type { MemoColor, ColorPalette, PaletteDefinition } from '@/lib/types'

// Seed folders carry a stable, device-independent `syncId`.
// Cross-device sync identifies folders by syncId, so seeding with a random id
// per device made every new device's defaults look distinct from the cloud's,
// producing duplicates on login. Canonical ids keep them unified everywhere.
export const DEFAULT_FOLDERS = [
  { name: '내 메모', color: '#F59E0B', isDefault: true, isSystem: false, syncId: 'seed-default-my-memos' },
  { name: '스크랩', color: '#84CC16', isDefault: false, isSystem: false, syncId: 'seed-default-scrap' },
  { name: '아이디어', color: '#22C55E', isDefault: false, isSystem: false, syncId: 'seed-default-idea' },
  { name: '쇼핑', color: '#06B6D4', isDefault: false, isSystem: false, syncId: 'seed-default-shopping' },
] as const

export const SYSTEM_FOLDERS = [
  { name: '삭제된 메모', color: '#A1A1AA', isDefault: false, isSystem: true, syncId: 'seed-system-trash' },
] as const

export const FOLDER_COLORS = [
  '#F59E0B', '#84CC16', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
] as const

// Korean color names for accessible labels on color swatch pickers (aria-label)
export const FOLDER_COLOR_NAMES: Record<string, string> = {
  '#F59E0B': '주황',
  '#84CC16': '연두',
  '#22C55E': '초록',
  '#06B6D4': '청록',
  '#3B82F6': '파랑',
  '#8B5CF6': '보라',
  '#EC4899': '분홍',
  '#EF4444': '빨강',
}

export const MEMO_COLORS: Record<MemoColor, string> = {
  white: '#FFFFFF',
  yellow: '#FEF3C7',
  green: '#DCFCE7',
  blue: '#DBEAFE',
  pink: '#FCE7F3',
  purple: '#F3E8FF',
}

export const MEMO_PAGE_BG: Record<MemoColor, string> = {
  white:  'bg-transparent',
  yellow: 'bg-amber-50/60 dark:bg-amber-950/15',
  green:  'bg-emerald-50/60 dark:bg-emerald-950/15',
  blue:   'bg-blue-50/60 dark:bg-blue-950/15',
  pink:   'bg-pink-50/60 dark:bg-pink-950/15',
  purple: 'bg-purple-50/60 dark:bg-purple-950/15',
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

export const COLOR_PALETTES: Record<ColorPalette, PaletteDefinition> = {
  default: {
    id: 'default',
    name: 'Default',
    nameKo: '기본',
    colors: { primary: '#6366F1', secondary: '#4338CA' },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    nameKo: '오션',
    colors: { primary: '#3B82F6', secondary: '#1D4ED8' },
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    nameKo: '로즈',
    colors: { primary: '#F472B6', secondary: '#DB2777' },
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    nameKo: '퍼플',
    colors: { primary: '#A78BFA', secondary: '#7C3AED' },
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    nameKo: '포레스트',
    colors: { primary: '#34D399', secondary: '#059669' },
  },
}

export const BACKUP_CONFIG = {
  CURRENT_VERSION: '1.0.0',
  APP_NAME: 'Memo',
  FILE_PREFIX: 'Memo_Backup',
} as const
