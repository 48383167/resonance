import { reactive } from 'vue'
import { getTheme, updateTheme } from '../modules/theme/theme.api.js'
import { DEFAULT_THEME, normalizeTheme } from '../theme/presets'

const CACHE_PREFIX = 'resonance.theme.cache.'

export const currentTheme = reactive({
  ...DEFAULT_THEME,
  mode: 'dark',
  pageColors: ['#070a18', '#070a18', '#070a18'],
  accentContrast: '#1a1030',
  accentText: '#d8a7ff',
  accent2Text: '#7ec8ff',
})

let activeUserId = ''
let requestSerial = 0
let pendingLoad = null

function rgbParts(hex) {
  const value = Number.parseInt(hex.slice(1), 16)
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
}

function luminance(hex) {
  const value = hex.slice(1).match(/.{2}/g).map((part) => Number.parseInt(part, 16) / 255)
  const channels = value.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(a, b) {
  const light = Math.max(luminance(a), luminance(b))
  const dark = Math.min(luminance(a), luminance(b))
  return (light + 0.05) / (dark + 0.05)
}

function mixHex(a, b, amount) {
  const left = Number.parseInt(a.slice(1), 16)
  const right = Number.parseInt(b.slice(1), 16)
  const mix = (shift) => Math.round(((left >> shift) & 255) + ((((right >> shift) & 255) - ((left >> shift) & 255)) * amount))
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, '0')).join('')}`
}

function readableTextColor(color, background) {
  if (contrastRatio(color, background) >= 4.5) return color
  const target = luminance(background) > 0.5 ? '#101321' : '#ffffff'
  let adjusted = color
  for (let i = 0; i < 12; i++) {
    adjusted = mixHex(adjusted, target, 0.16)
    if (contrastRatio(adjusted, background) >= 4.5) return adjusted
  }
  return target
}

export function contrastColor(...backgrounds) {
  const whiteScore = Math.min(...backgrounds.map((background) => contrastRatio('#ffffff', background)))
  const darkScore = Math.min(...backgrounds.map((background) => contrastRatio('#101321', background)))
  return whiteScore >= darkScore ? '#ffffff' : '#101321'
}

export function applyTheme(value) {
  const config = normalizeTheme(value)
  const mode = config.appearanceMode === 'auto'
    ? (luminance(config.ambientColor) > 0.35 ? 'light' : 'dark')
    : config.appearanceMode
  const defaults = mode === 'light'
    ? { text: '#302b43', muted: '#6e667b', border: '#302b43' }
    : { text: '#f4ecff', muted: '#a99bc4', border: '#ffffff' }
  const surfaceColor = config.surfaceColor || '#ffffff'
  const surfaceStrongColor = config.surfaceStrongColor || surfaceColor
  const textColor = config.textColor || defaults.text
  const mutedTextColor = config.mutedTextColor || defaults.muted
  const borderColor = config.borderColor || defaults.border
  const hasSurfaceColor = Boolean(config.surfaceColor)
  const pageTintAmount = mode === 'light' ? 0.08 : 0.18
  const pageColors = [
    mixHex(config.ambientColor, config.primaryColor, pageTintAmount),
    config.ambientColor,
    mixHex(config.ambientColor, config.secondaryColor, pageTintAmount),
  ]
  const glassAlpha = hasSurfaceColor ? (mode === 'light' ? '0.86' : '0.84') : (mode === 'light' ? '0.68' : '0.06')
  const controlAlpha = hasSurfaceColor ? (mode === 'light' ? '0.78' : '0.76') : (mode === 'light' ? '0.76' : '0.07')
  const accentText = readableTextColor(config.primaryColor, surfaceColor)
  const accent2Text = readableTextColor(config.secondaryColor, surfaceColor)
  Object.assign(currentTheme, config, { mode, pageColors,
    accentContrast: contrastColor(config.primaryColor, config.secondaryColor),
    accentText,
    accent2Text,
  })

  if (typeof document === 'undefined') return config
  const root = document.documentElement
  root.dataset.theme = config.themeKey
  root.dataset.themeMode = mode
  root.style.setProperty('--page-bg', config.ambientColor)
  root.style.setProperty('--page-bg-rgb', rgbParts(config.ambientColor))
  root.style.setProperty('--surface-1', surfaceColor)
  root.style.setProperty('--surface-1-rgb', rgbParts(surfaceColor))
  root.style.setProperty('--surface-2', surfaceStrongColor)
  root.style.setProperty('--surface-2-rgb', rgbParts(surfaceStrongColor))
  root.style.setProperty('--text-primary', textColor)
  root.style.setProperty('--text-primary-rgb', rgbParts(textColor))
  root.style.setProperty('--text-secondary', mutedTextColor)
  root.style.setProperty('--text-secondary-rgb', rgbParts(mutedTextColor))
  root.style.setProperty('--border-subtle', borderColor)
  root.style.setProperty('--border-subtle-rgb', rgbParts(borderColor))
  root.style.setProperty('--accent', config.primaryColor)
  root.style.setProperty('--accent-rgb', rgbParts(config.primaryColor))
  root.style.setProperty('--accent-2', config.secondaryColor)
  root.style.setProperty('--accent-2-rgb', rgbParts(config.secondaryColor))
  root.style.setProperty('--accent-text', accentText)
  root.style.setProperty('--accent-2-text', accent2Text)
  root.style.setProperty('--ambient', config.ambientColor)
  root.style.setProperty('--ambient-rgb', rgbParts(config.ambientColor))
  root.style.setProperty('--ink', textColor)
  root.style.setProperty('--ink-rgb', rgbParts(textColor))
  root.style.setProperty('--muted', mutedTextColor)
  root.style.setProperty('--muted-rgb', rgbParts(mutedTextColor))
  root.style.setProperty('--surface-rgb', rgbParts(surfaceColor))
  root.style.setProperty('--surface-soft-rgb', hasSurfaceColor ? rgbParts(surfaceColor) : (mode === 'light' ? rgbParts(textColor) : '255 255 255'))
  root.style.setProperty('--surface-soft-alpha', hasSurfaceColor ? controlAlpha : (mode === 'light' ? '0.06' : '0.05'))
  root.style.setProperty('--glass-alpha', glassAlpha)
  root.style.setProperty('--glass-border-alpha', mode === 'light' ? '0.2' : '0.12')
  root.style.setProperty('--control-alpha', controlAlpha)
  root.style.setProperty('--control-border-alpha', mode === 'light' ? '0.24' : '0.15')
  root.style.setProperty('--ghost-border-alpha', mode === 'light' ? '0.28' : '0.2')
  root.style.setProperty('--shadow-rgb', mode === 'light' ? '40 30 60' : '0 0 0')
  root.style.setProperty('--shadow-alpha', mode === 'light' ? '0.12' : '0.3')
  root.style.setProperty('--accent-contrast', currentTheme.accentContrast)
  return config
}

function cacheKey(userId) {
  return `${CACHE_PREFIX}${userId}`
}

function readCache(userId) {
  try {
    const value = localStorage.getItem(cacheKey(userId))
    return value ? normalizeTheme(JSON.parse(value)) : null
  } catch {
    return null
  }
}

function writeCache(userId, value) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(normalizeTheme(value)))
  } catch {
    // 缓存不可用时仍以服务端配置为准
  }
}

export function loadTheme(userId) {
  if (!userId) return Promise.resolve(applyTheme(DEFAULT_THEME))
  activeUserId = String(userId)
  const cached = readCache(activeUserId)
  applyTheme(cached || DEFAULT_THEME)

  if (pendingLoad?.userId === activeUserId) return pendingLoad.promise
  const serial = ++requestSerial
  const loadedUserId = activeUserId
  const promise = getTheme()
    .then((value) => {
      if (serial === requestSerial && activeUserId === loadedUserId) applyTheme(value)
      writeCache(loadedUserId, value)
      return value
    })
    .catch(() => {
      if (serial === requestSerial && activeUserId === loadedUserId) applyTheme(cached || DEFAULT_THEME)
      return cached || DEFAULT_THEME
    })
  pendingLoad = { userId: loadedUserId, promise }
  return promise
}

export async function saveTheme(value, userId = activeUserId) {
  if (!userId || String(userId) !== activeUserId) throw new Error('主题所属用户已变化，请刷新后重试')
  const next = normalizeTheme(value)
  const previous = normalizeTheme(currentTheme)
  applyTheme(next)
  writeCache(activeUserId, next)
  try {
    const saved = await updateTheme(next)
    if (activeUserId === String(userId)) applyTheme(saved)
    writeCache(String(userId), saved)
    return saved
  } catch (error) {
    if (activeUserId === String(userId)) {
      applyTheme(previous)
      writeCache(String(userId), previous)
    }
    throw error
  }
}

export function resetTheme() {
  activeUserId = ''
  requestSerial += 1
  pendingLoad = null
  applyTheme(DEFAULT_THEME)
}

applyTheme(DEFAULT_THEME)
