import { db } from '../../config/database.js'

export function findByUserId(userId) {
  return db.prepare(
    `SELECT user_id, theme_key, primary_color, secondary_color, ambient_color,
            appearance_mode, surface_color, surface_strong_color, text_color,
            muted_text_color, border_color, updated_at
       FROM user_theme_settings WHERE user_id = ?`
  ).get(userId) || null
}

export function upsert(userId, {
  themeKey, primaryColor, secondaryColor, ambientColor, appearanceMode,
  surfaceColor, surfaceStrongColor, textColor, mutedTextColor, borderColor,
}) {
  db.prepare(`
    INSERT INTO user_theme_settings (
      user_id, theme_key, primary_color, secondary_color, ambient_color,
      appearance_mode, surface_color, surface_strong_color, text_color,
      muted_text_color, border_color, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id) DO UPDATE SET
      theme_key = excluded.theme_key,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      ambient_color = excluded.ambient_color,
      appearance_mode = excluded.appearance_mode,
      surface_color = excluded.surface_color,
      surface_strong_color = excluded.surface_strong_color,
      text_color = excluded.text_color,
      muted_text_color = excluded.muted_text_color,
      border_color = excluded.border_color,
      updated_at = excluded.updated_at
  `).run(
    userId, themeKey, primaryColor, secondaryColor, ambientColor, appearanceMode,
    surfaceColor, surfaceStrongColor, textColor, mutedTextColor, borderColor,
  )
  return findByUserId(userId)
}
