import { BadRequestError } from '../../common/errors/BadRequestError.js'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const THEME_KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/
const APPEARANCE_MODES = new Set(['auto', 'light', 'dark'])

export function parseTheme(body = {}) {
  const themeKey = String(body.themeKey || '').trim().toLowerCase()
  const primaryColor = String(body.primaryColor || '').trim().toLowerCase()
  const secondaryColor = String(body.secondaryColor || '').trim().toLowerCase()
  const ambientColor = String(body.ambientColor || '').trim().toLowerCase()
  const appearanceMode = String(body.appearanceMode || 'auto').trim().toLowerCase()
  const normalizeOptional = (v) => v == null || v === '' ? null : String(v).trim().toLowerCase()
  const surfaceColor = normalizeOptional(body.surfaceColor)
  const surfaceStrongColor = normalizeOptional(body.surfaceStrongColor)
  const textColor = normalizeOptional(body.textColor)
  const mutedTextColor = normalizeOptional(body.mutedTextColor)
  const borderColor = normalizeOptional(body.borderColor)

  if (!THEME_KEY.test(themeKey)) throw new BadRequestError('主题标识不合法')
  if (!APPEARANCE_MODES.has(appearanceMode)) throw new BadRequestError('明暗模式不合法')
  if (![primaryColor, secondaryColor, ambientColor].every((c) => HEX_COLOR.test(c))) {
    throw new BadRequestError('主题颜色必须是 6 位 HEX 颜色')
  }
  if ([surfaceColor, surfaceStrongColor, textColor, mutedTextColor, borderColor]
    .some((c) => c != null && !HEX_COLOR.test(c))) {
    throw new BadRequestError('细节颜色必须是 6 位 HEX 颜色')
  }
  return {
    themeKey, primaryColor, secondaryColor, ambientColor, appearanceMode,
    surfaceColor, surfaceStrongColor, textColor, mutedTextColor, borderColor,
  }
}
