import * as themeRepository from './theme.repository.js'
import * as themeSchema from './theme.schema.js'

const DEFAULT_THEME = {
  themeKey: 'starlight',
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

function toResponse(row) {
  if (!row) return { ...DEFAULT_THEME, updatedAt: null }
  return {
    themeKey: row.theme_key,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    ambientColor: row.ambient_color,
    appearanceMode: row.appearance_mode,
    surfaceColor: row.surface_color,
    surfaceStrongColor: row.surface_strong_color,
    textColor: row.text_color,
    mutedTextColor: row.muted_text_color,
    borderColor: row.border_color,
    updatedAt: row.updated_at,
  }
}

export function getTheme(userId) {
  return toResponse(themeRepository.findByUserId(userId))
}

export function updateTheme(userId, raw) {
  return toResponse(themeRepository.upsert(userId, themeSchema.parseTheme(raw)))
}
