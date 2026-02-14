export type ColorPalette = 'default' | 'ocean' | 'rose' | 'purple' | 'forest'

export interface PaletteDefinition {
  id: ColorPalette
  name: string
  nameKo: string
  colors: {
    primary: string
    secondary: string
  }
}

export const COLOR_PALETTES: Record<ColorPalette, PaletteDefinition> = {
  default: {
    id: 'default',
    name: 'Mint',
    nameKo: '민트',
    colors: { primary: '#2EFFB4', secondary: '#00A86B' },
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
  CURRENT_VERSION: '2.0.0',
  SUPPORTED_VERSIONS: ['1.0.0', '2.0.0'],
  APP_NAME: 'Todo List',
  FILE_PREFIX: 'TodoList_Backup',
} as const

export const DEFAULT_CATEGORIES = [
  { name: '작업', color: '#3B82F6' },
  { name: '개인', color: '#10B981' },
  { name: '위시리스트', color: '#F59E0B' },
] as const

export const PRIORITY_COLORS = {
  none: '#a1a1aa',
  low: '#3B82F6',
  medium: '#F59E0B',
  high: '#EF4444',
} as const
