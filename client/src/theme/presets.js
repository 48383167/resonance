export const DEFAULT_THEME_KEY = 'starlight'

export const THEME_PRESETS = [
  {
    key: 'starlight',
    name: '星河紫蓝',
    description: '夜空里交换的微光',
    primaryColor: '#d8a7ff',
    secondaryColor: '#7ec8ff',
    ambientColor: '#070a18',
    appearanceMode: 'dark',
    surfaceColor: '#11152d',
    surfaceStrongColor: '#1b2144',
    textColor: '#f4ecff',
    mutedTextColor: '#a99bc4',
    borderColor: '#5d4a88',
  },
  {
    key: 'rose-dusk',
    name: '玫瑰晚霞',
    description: '温柔、浪漫的晚霞色',
    primaryColor: '#ff9fba',
    secondaryColor: '#ffcfad',
    ambientColor: '#170b18',
    appearanceMode: 'dark',
    surfaceColor: '#2b1528',
    surfaceStrongColor: '#45223b',
    textColor: '#fff2f6',
    mutedTextColor: '#d5a8bc',
    borderColor: '#8f4e72',
  },
  {
    key: 'seafoam',
    name: '海盐薄荷',
    description: '清透的海风与薄荷',
    primaryColor: '#82e6d0',
    secondaryColor: '#7db8ff',
    ambientColor: '#07171a',
    appearanceMode: 'dark',
    surfaceColor: '#0c2a2c',
    surfaceStrongColor: '#124348',
    textColor: '#eafff8',
    mutedTextColor: '#9ccac4',
    borderColor: '#3e8f8b',
  },
  {
    key: 'amber-lamp',
    name: '琥珀灯影',
    description: '暖灯下慢慢写信',
    primaryColor: '#ffd083',
    secondaryColor: '#ff9f72',
    ambientColor: '#18100a',
    appearanceMode: 'dark',
    surfaceColor: '#302016',
    surfaceStrongColor: '#4b2d1c',
    textColor: '#fff4df',
    mutedTextColor: '#cdb08a',
    borderColor: '#9c6f3e',
  },
  {
    key: 'forest-mist',
    name: '森林薄雾',
    description: '安静而有生命力的绿意',
    primaryColor: '#a8e6c1',
    secondaryColor: '#8bc8d9',
    ambientColor: '#081713',
    appearanceMode: 'dark',
    surfaceColor: '#10281e',
    surfaceStrongColor: '#183c2c',
    textColor: '#ecfff2',
    mutedTextColor: '#9fc1ac',
    borderColor: '#4d8566',
  },
  {
    key: 'peach-morning',
    name: '晨曦蜜桃',
    description: '像清晨窗帘透进来的暖光',
    primaryColor: '#f0a0a6',
    secondaryColor: '#f4bd9e',
    ambientColor: '#fff0e6',
    appearanceMode: 'light',
    surfaceColor: '#fffaf7',
    surfaceStrongColor: '#ffffff',
    textColor: '#4a2833',
    mutedTextColor: '#8d6770',
    borderColor: '#e4a0a7',
  },
  {
    key: 'clear-sky',
    name: '晴空薄荷',
    description: '明亮、清爽的晴日空气',
    primaryColor: '#7bd8b4',
    secondaryColor: '#8fc8f2',
    ambientColor: '#e9fbf5',
    appearanceMode: 'light',
    surfaceColor: '#f7fffc',
    surfaceStrongColor: '#ffffff',
    textColor: '#203d3a',
    mutedTextColor: '#5d817b',
    borderColor: '#9ed8cc',
  },
  {
    key: 'moon-cream',
    name: '月白奶油',
    description: '奶油色月光落在纸页上',
    primaryColor: '#e4bd5d',
    secondaryColor: '#9faee0',
    ambientColor: '#fff8df',
    appearanceMode: 'light',
    surfaceColor: '#fffdf4',
    surfaceStrongColor: '#ffffff',
    textColor: '#443b20',
    mutedTextColor: '#887d5b',
    borderColor: '#ddc77c',
  },
]

export const DEFAULT_THEME = {
  themeKey: DEFAULT_THEME_KEY,
  primaryColor: '#d8a7ff',
  secondaryColor: '#7ec8ff',
  ambientColor: '#070a18',
  appearanceMode: 'auto',
  surfaceColor: null,
  surfaceStrongColor: null,
  textColor: null,
  mutedTextColor: null,
  borderColor: null,
}

export function normalizeHex(value, fallback) {
  const color = String(value || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(color) ? color : fallback
}

function normalizeOptionalHex(value) {
  if (value == null || value === '') return null
  const color = String(value).trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(color) ? color : null
}

export function normalizeTheme(value) {
  const source = value || {}
  const themeKey = String(source.themeKey || DEFAULT_THEME_KEY).trim().toLowerCase()
  const preset = THEME_PRESETS.find((item) => item.key === themeKey)
  const appearanceMode = String(source.appearanceMode || preset?.appearanceMode || DEFAULT_THEME.appearanceMode).trim().toLowerCase()
  return {
    themeKey,
    primaryColor: normalizeHex(source.primaryColor, DEFAULT_THEME.primaryColor),
    secondaryColor: normalizeHex(source.secondaryColor, DEFAULT_THEME.secondaryColor),
    ambientColor: normalizeHex(source.ambientColor, DEFAULT_THEME.ambientColor),
    appearanceMode: ['auto', 'light', 'dark'].includes(appearanceMode) ? appearanceMode : 'auto',
    surfaceColor: normalizeOptionalHex(source.surfaceColor) || preset?.surfaceColor || null,
    surfaceStrongColor: normalizeOptionalHex(source.surfaceStrongColor) || preset?.surfaceStrongColor || null,
    textColor: normalizeOptionalHex(source.textColor) || preset?.textColor || null,
    mutedTextColor: normalizeOptionalHex(source.mutedTextColor) || preset?.mutedTextColor || null,
    borderColor: normalizeOptionalHex(source.borderColor) || preset?.borderColor || null,
  }
}

export function presetConfig(preset) {
  return normalizeTheme({ ...preset, themeKey: preset.key || preset.themeKey })
}
