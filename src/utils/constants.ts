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
