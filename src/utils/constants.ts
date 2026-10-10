// Seed folders carry a stable, device-independent `syncId`.
// Cross-device sync identifies folders by syncId, so seeding with a random id
// per device made every new device's defaults look distinct from the cloud's,
// producing duplicates on login. Canonical ids keep them unified everywhere.
// 폴더의 색은 키트의 범주 색(--mw-cat-*)에서 골라요. 값은 토큰 이름째로 저장해요: 테마가 바뀌면 함께 바뀌어요.
// 예전에 고른 색(#F59E0B 같은 값)은 폴더에 저장된 그대로 그려요.
const CAT = (n: number | 'other') => `var(--mw-cat-${n})`

export const DEFAULT_FOLDERS = [
  { name: '내 메모', color: CAT(2), isDefault: true, isSystem: false, syncId: 'seed-default-my-memos' },
  { name: '스크랩', color: CAT(6), isDefault: false, isSystem: false, syncId: 'seed-default-scrap' },
  { name: '아이디어', color: CAT(8), isDefault: false, isSystem: false, syncId: 'seed-default-idea' },
  { name: '쇼핑', color: CAT(7), isDefault: false, isSystem: false, syncId: 'seed-default-shopping' },
] as const

export const SYSTEM_FOLDERS = [
  { name: '삭제된 메모', color: CAT('other'), isDefault: false, isSystem: true, syncId: 'seed-system-trash' },
] as const

/** 폴더 색이 없을 때 */
export const FOLDER_FALLBACK_COLOR = CAT('other')

// 고를 수 있는 색은 일곱 가지예요 (한눈에 고르는 선택지는 일곱 개 안쪽)
export const FOLDER_COLORS = [CAT(2), CAT(6), CAT(8), CAT(7), CAT(5), CAT(3), CAT(4)] as const

// 색의 이름: 색만으로 알리지 않고 이름을 함께 보여 줘요
export const FOLDER_COLOR_NAMES: Record<string, string> = {
  [CAT(2)]: '주황',
  [CAT(6)]: '연두',
  [CAT(8)]: '초록',
  [CAT(7)]: '하늘',
  [CAT(5)]: '파랑',
  [CAT(3)]: '보라',
  [CAT(4)]: '분홍',
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
