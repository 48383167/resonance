import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.RESONANCE_DATA_DIR || path.join(__dirname, '..')
export const DB_PATH = path.join(DATA_DIR, 'database.sqlite')
export const MEDIA_DIR = path.join(DATA_DIR, 'media')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(MEDIA_DIR, { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')

// —— 轻量列迁移：为老库补齐后加的列（幂等；须在建表之后执行）——
function ensureColumns(table, columns) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name))
  for (const [name, ddl] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`)
  }
}

// —— 建表（依据开发手册 §3，仅补充配对码与停顿时长两个必要字段）——
// 时间统一存 ISO8601 UTC（带 Z），前端 new Date() 解析后自动转本地时区
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    nickname TEXT NOT NULL,
    avatar_url TEXT,
    pair_code TEXT,
    paired_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_theme_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    theme_key TEXT NOT NULL DEFAULT 'starlight',
    primary_color TEXT NOT NULL DEFAULT '#d8a7ff',
    secondary_color TEXT NOT NULL DEFAULT '#7ec8ff',
    ambient_color TEXT NOT NULL DEFAULT '#070a18',
    appearance_mode TEXT NOT NULL DEFAULT 'auto',
    surface_color TEXT,
    surface_strong_color TEXT,
    text_color TEXT,
    muted_text_color TEXT,
    border_color TEXT,
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'solo', -- 'solo' (单人日记)
    title TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    is_public BOOLEAN DEFAULT 0, -- 是否在展示页公开
    weather_code TEXT,  -- 环境底片：天气
    time_color_hex TEXT, -- 环境底片：时间映射色
    media TEXT DEFAULT '[]' -- 附件 JSON：[{url, type: image|video|file}]
);

CREATE TABLE IF NOT EXISTS entry_contents (
    id TEXT PRIMARY KEY,
    entry_id TEXT REFERENCES entries(id),
    user_id TEXT REFERENCES users(id),
    content TEXT,
    typing_speed INTEGER, -- 情绪墨水：打字速度
    delete_count INTEGER, -- 情绪墨水：删除次数
    pause_duration INTEGER, -- 情绪墨水：停顿时间(ms)
    status TEXT DEFAULT 'draft' -- 'draft', 'submitted'
);
`)

// —— 用户 ——
export function userCount() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c
}

export function getUser(id) {
  return db.prepare('SELECT id, username, nickname, avatar_url, pair_code, paired_at FROM users WHERE id = ?').get(id)
}

export function getUserByUsername(username) {
  return db.prepare('SELECT id, username, password_hash, nickname, avatar_url, pair_code, paired_at FROM users WHERE username = ?').get(username)
}

export function getUserByPairCode(code) {
  return db.prepare('SELECT id, username, nickname, avatar_url, pair_code, paired_at FROM users WHERE pair_code = ?').get(code)
}

// 返回同一配对下的另一方（排除自己）
export function getPartnerOf(userId, pairCode) {
  const rows = db.prepare('SELECT id, username, nickname, avatar_url, pair_code, paired_at FROM users WHERE pair_code = ?').all(pairCode)
  return rows.find((r) => r.id !== userId) || null
}

export function listUsers() {
  return db.prepare('SELECT id, username, nickname, avatar_url, pair_code, paired_at FROM users ORDER BY paired_at ASC').all()
}

// 注册新用户（严格两人：第一人生成配对码，第二人凭配对码加入）
export function registerUser({ username, passwordHash, nickname, pairCode }) {
  const id = 'u_' + randomUUID().slice(0, 12)
  db.prepare(
    'INSERT INTO users (id, username, password_hash, nickname, pair_code) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, passwordHash, nickname, pairCode)
  return getUser(id)
}

// 第二人加入时标记配对完成
export function markPaired(pairCode) {
  db.prepare('UPDATE users SET paired_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE pair_code = ?').run(pairCode)
}

export function setUserPassword(id, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}

// —— 日记 ——
export function createEntry({ title, weatherCode, timeColorHex, media }) {
  const id = 'e_' + randomUUID().slice(0, 12)
  db.prepare(
    'INSERT INTO entries (id, type, title, weather_code, time_color_hex, media) VALUES (?, \'solo\', ?, ?, ?, ?)'
  ).run(id, title || null, weatherCode || null, timeColorHex || null, JSON.stringify(media || []))
  return getEntry(id)
}

export function getEntry(id) {
  return db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
}

export function listEntries() {
  const rows = db
    .prepare('SELECT * FROM entries ORDER BY created_at DESC')
    .all()
  return rows.map(attachContents)
}

export function listPublicEntries() {
  return db
    .prepare('SELECT * FROM entries WHERE is_public = 1 ORDER BY created_at DESC')
    .all()
    .map(attachContents)
}

export function setEntryVisibility(id, isPublic) {
  db.prepare('UPDATE entries SET is_public = ? WHERE id = ?').run(isPublic ? 1 : 0, id)
}

export function deleteEntry(id) {
  db.prepare('DELETE FROM entry_contents WHERE entry_id = ?').run(id)
  db.prepare('DELETE FROM entries WHERE id = ?').run(id)
}

// —— 分片内容（单人日记一篇一条）——
export function createContent({ entryId, userId, content, typingSpeed, deleteCount, pauseDuration }) {
  const id = 'c_' + randomUUID().slice(0, 12)
  db.prepare(
    `INSERT INTO entry_contents (id, entry_id, user_id, content, typing_speed, delete_count, pause_duration, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')`
  ).run(id, entryId, userId, content, typingSpeed || 0, deleteCount || 0, pauseDuration || 0)
  return db.prepare('SELECT * FROM entry_contents WHERE id = ?').get(id)
}

export function getContents(entryId) {
  return db.prepare('SELECT * FROM entry_contents WHERE entry_id = ?').all(entryId)
}

export function attachContents(entry) {
  entry.contents = getContents(entry.id)
  try {
    entry.media = JSON.parse(entry.media || '[]')
  } catch {
    entry.media = []
  }
  return entry
}

// ===================== loveNest 参考模块 =====================
// 注：Resonance 严格双人配对，所有模块数据为两人共享，无需 couple 表

db.exec(`
-- 恋爱瞬间（文字+心情+地点坐标+图片）
CREATE TABLE IF NOT EXISTS moments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,           -- 作者
    content TEXT NOT NULL,
    mood TEXT DEFAULT 'normal',      -- normal/happy/sweet/missed/angry/sad
    location TEXT DEFAULT '',        -- 地点描述
    longitude REAL, latitude REAL,   -- 坐标（恋爱地图足迹）
    moment_date TEXT,                -- 发生日期 YYYY-MM-DD（可补记）
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS moment_photos (
    id TEXT PRIMARY KEY,
    moment_id TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 情书
CREATE TABLE IF NOT EXISTS love_letters (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    content TEXT NOT NULL,
    is_secret INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 相册与照片
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cover_url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS album_photos (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    url TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 心愿清单
CREATE TABLE IF NOT EXISTS wish_items (
    id TEXT PRIMARY KEY,
    proposer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'other',
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'todo',      -- todo/doing/done
    completed_at TEXT,               -- 完成时间（done 时记录）
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 时间胶囊
CREATE TABLE IF NOT EXISTS time_capsules (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    content TEXT NOT NULL,
    photo_url TEXT DEFAULT '',
    unlock_date TEXT NOT NULL,       -- YYYY-MM-DD
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 纪念日
CREATE TABLE IF NOT EXISTS anniversaries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'custom',      -- first_meet/together/birthday/custom
    date TEXT NOT NULL,              -- YYYY-MM-DD
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 分享令牌
CREATE TABLE IF NOT EXISTS share_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    password TEXT DEFAULT '',
    expires_at TEXT,                 -- ISO8601，空 = 永久
    view_count INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,        -- 1=有效 0=已停用
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`)

// 老库补列：日记附件、心愿阶段时间节点、情书阅读时间
ensureColumns('entries', { media: "TEXT DEFAULT '[]'" })
ensureColumns('wish_items', {
  completed_at: 'TEXT',
  started_at: 'TEXT',
})
ensureColumns('love_letters', { read_at: 'TEXT' })
ensureColumns('user_theme_settings', {
  appearance_mode: "TEXT NOT NULL DEFAULT 'auto'",
  surface_color: 'TEXT',
  surface_strong_color: 'TEXT',
  text_color: 'TEXT',
  muted_text_color: 'TEXT',
  border_color: 'TEXT',
})

const newId = (prefix) => prefix + '_' + randomUUID().slice(0, 12)

// —— 用户资料 ——
export function updateUser(id, { nickname, avatarUrl }) {
  db.prepare('UPDATE users SET nickname = COALESCE(?, nickname), avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
    .run(nickname || null, avatarUrl || null, id)
  return getUser(id)
}

// —— 用户主题 ——
export function getUserTheme(userId) {
  return db.prepare(
    `SELECT user_id, theme_key, primary_color, secondary_color, ambient_color,
            appearance_mode, surface_color, surface_strong_color, text_color,
            muted_text_color, border_color, updated_at
       FROM user_theme_settings WHERE user_id = ?`
  ).get(userId) || null
}

export function upsertUserTheme(userId, {
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
  return getUserTheme(userId)
}

// —— 恋爱瞬间 ——
export function createMoment({ userId, content, mood, location, longitude, latitude, momentDate, photos }) {
  const id = newId('m')
  db.prepare(
    'INSERT INTO moments (id, user_id, content, mood, location, longitude, latitude, moment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, content, mood || 'normal', location || '', longitude ?? null, latitude ?? null, momentDate || null)
  setMomentPhotos(id, photos || [])
  return getMoment(id)
}

export function setMomentPhotos(momentId, photos) {
  db.prepare('DELETE FROM moment_photos WHERE moment_id = ?').run(momentId)
  for (const url of photos) {
    db.prepare('INSERT INTO moment_photos (id, moment_id, url) VALUES (?, ?, ?)').run(newId('mp'), momentId, url)
  }
}

export function getMoment(id) {
  const m = db.prepare('SELECT * FROM moments WHERE id = ?').get(id)
  if (!m) return null
  m.photos = db.prepare('SELECT url FROM moment_photos WHERE moment_id = ?').all(id).map((r) => r.url)
  m.author = getUser(m.user_id)
  return m
}

export function listMoments({ mood, keyword, startDate, endDate } = {}) {
  const conds = []
  const args = []
  if (mood) { conds.push('mood = ?'); args.push(mood) }
  if (keyword) { conds.push('(content LIKE ? OR location LIKE ?)'); args.push(`%${keyword}%`, `%${keyword}%`) }
  if (startDate) { conds.push('COALESCE(moment_date, date(created_at)) >= ?'); args.push(startDate) }
  if (endDate) { conds.push('COALESCE(moment_date, date(created_at)) <= ?'); args.push(endDate) }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
  const rows = db.prepare(`SELECT * FROM moments ${where} ORDER BY COALESCE(moment_date, date(created_at)) DESC, datetime(created_at) DESC`).all(...args)
  return rows.map((m) => {
    m.photos = db.prepare('SELECT url FROM moment_photos WHERE moment_id = ?').all(m.id).map((r) => r.url)
    m.author = getUser(m.user_id)
    return m
  })
}

export function listMomentsWithCoords() {
  return db.prepare('SELECT * FROM moments WHERE longitude IS NOT NULL AND latitude IS NOT NULL ORDER BY COALESCE(moment_date, date(created_at)) ASC').all()
}

export function updateMoment(id, { content, mood, location, longitude, latitude, momentDate, photos }) {
  db.prepare(
    'UPDATE moments SET content = COALESCE(?, content), mood = COALESCE(?, mood), location = COALESCE(?, location), longitude = COALESCE(?, longitude), latitude = COALESCE(?, latitude), moment_date = COALESCE(?, moment_date) WHERE id = ?'
  ).run(content ?? null, mood ?? null, location ?? null, longitude ?? null, latitude ?? null, momentDate ?? null, id)
  if (photos) setMomentPhotos(id, photos)
  return getMoment(id)
}

export function deleteMoment(id) {
  db.prepare('DELETE FROM moment_photos WHERE moment_id = ?').run(id)
  db.prepare('DELETE FROM moments WHERE id = ?').run(id)
}

// —— 情书 ——
export function createLetter({ senderId, title, content, isSecret }) {
  const id = newId('l')
  db.prepare('INSERT INTO love_letters (id, sender_id, title, content, is_secret, is_read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, senderId, title || '', content, isSecret ? 1 : 0)
  return getLetter(id)
}

export function getLetter(id) {
  const l = db.prepare('SELECT * FROM love_letters WHERE id = ?').get(id)
  if (l) l.sender = getUser(l.sender_id)
  return l
}

export function listLetters() {
  const rows = db.prepare('SELECT * FROM love_letters ORDER BY datetime(created_at) DESC').all()
  return rows.map((l) => ({ ...l, sender: getUser(l.sender_id) }))
}

export function markLetterRead(id) {
  db.prepare("UPDATE love_letters SET is_read = 1, read_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ? AND is_read = 0").run(id)
}

export function updateLetter(id, { title, content, isSecret }) {
  db.prepare(
    'UPDATE love_letters SET title = COALESCE(?, title), content = COALESCE(?, content), is_secret = COALESCE(?, is_secret) WHERE id = ?'
  ).run(title ?? null, content ?? null, isSecret == null ? null : (isSecret ? 1 : 0), id)
  return getLetter(id)
}

export function deleteLetter(id) {
  db.prepare('DELETE FROM love_letters WHERE id = ?').run(id)
}

// —— 相册 ——
export function createAlbum({ name, coverUrl, description }) {
  const id = newId('a')
  db.prepare('INSERT INTO albums (id, name, cover_url, description) VALUES (?, ?, ?, ?)')
    .run(id, name, coverUrl || '', description || '')
  return getAlbum(id)
}

export function getAlbum(id) {
  const a = db.prepare('SELECT * FROM albums WHERE id = ?').get(id)
  if (a) a.photos = getAlbumPhotos(id)
  return a
}

export function listAlbums() {
  return db.prepare('SELECT * FROM albums ORDER BY datetime(created_at) DESC').all()
    .map((a) => {
      const photos = getAlbumPhotos(a.id)
      // 封面未设置时用第一张代替展示（仅展示，不落库）
      return { ...a, photoCount: photos.length, firstPhotoUrl: photos[0]?.url || '' }
    })
}

export function deleteAlbum(id) {
  db.prepare('DELETE FROM album_photos WHERE album_id = ?').run(id)
  db.prepare('DELETE FROM albums WHERE id = ?').run(id)
}

export function getAlbumPhotos(albumId) {
  return db.prepare('SELECT * FROM album_photos WHERE album_id = ? ORDER BY datetime(created_at) DESC').all(albumId)
}

export function addAlbumPhoto(albumId, { url, caption }) {
  const id = newId('ap')
  db.prepare('INSERT INTO album_photos (id, album_id, url, caption) VALUES (?, ?, ?, ?)')
    .run(id, albumId, url, caption || '')
  return getAlbum(albumId)
}

export function deleteAlbumPhoto(photoId) {
  const photo = db.prepare('SELECT * FROM album_photos WHERE id = ?').get(photoId)
  if (!photo) return null
  db.prepare('DELETE FROM album_photos WHERE id = ?').run(photoId)
  // 封面与图片集独立：仅当被删的恰好是封面时清空（不自动换成别的照片）
  const album = db.prepare('SELECT cover_url FROM albums WHERE id = ?').get(photo.album_id)
  if (album && album.cover_url === photo.url) {
    db.prepare('UPDATE albums SET cover_url = \'\' WHERE id = ?').run(photo.album_id)
  }
  return photo.album_id
}

export function setAlbumCover(albumId, url) {
  db.prepare('UPDATE albums SET cover_url = ? WHERE id = ?').run(url, albumId)
  return getAlbum(albumId)
}

export function updateAlbum(id, { name, description }) {
  db.prepare('UPDATE albums SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
    .run(name ?? null, description ?? null, id)
  return getAlbum(id)
}

// 分页获取照片（按时间倒序）
export function albumPhotosPage(albumId, offset, limit) {
  const total = db.prepare('SELECT COUNT(*) AS c FROM album_photos WHERE album_id = ?').get(albumId).c
  const items = db.prepare(
    'SELECT * FROM album_photos WHERE album_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?'
  ).all(albumId, limit, offset)
  return { items, total }
}

export function updateAlbumPhotoCaption(photoId, caption) {
  db.prepare('UPDATE album_photos SET caption = ? WHERE id = ?').run(caption ?? '', photoId)
  const p = db.prepare('SELECT * FROM album_photos WHERE id = ?').get(photoId)
  return p || null
}

// —— 心愿清单 ——
export function createWish({ proposerId, title, description, category, priority, status }) {
  const id = newId('w')
  db.prepare('INSERT INTO wish_items (id, proposer_id, title, description, category, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, proposerId, title, description || '', category || 'other', priority || 0, status || 'todo')
  return getWish(id)
}

export function getWish(id) {
  const w = db.prepare('SELECT * FROM wish_items WHERE id = ?').get(id)
  if (w) w.proposer = getUser(w.proposer_id)
  return w
}

export function listWishes() {
  return db.prepare('SELECT * FROM wish_items ORDER BY priority DESC, datetime(created_at) ASC').all()
    .map((w) => ({ ...w, proposer: getUser(w.proposer_id) }))
}

export function updateWish(id, { title, description, category, priority, status }) {
  if (status !== undefined) {
    const prev = db.prepare('SELECT status FROM wish_items WHERE id = ?').get(id)
    if (prev && status !== prev.status) {
      // 阶段流转时间节点：done 记完成时间，doing 记开始时间，回退则清空
      const stamp = status === 'done' ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'NULL'
      const startStamp = status === 'doing' ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'NULL'
      db.prepare(`UPDATE wish_items SET completed_at = ${stamp}, started_at = ${startStamp} WHERE id = ?`).run(id)
    }
  }
  db.prepare(
    'UPDATE wish_items SET title = COALESCE(?, title), description = COALESCE(?, description), category = COALESCE(?, category), priority = COALESCE(?, priority), status = COALESCE(?, status) WHERE id = ?'
  ).run(title ?? null, description ?? null, category ?? null, priority ?? null, status ?? null, id)
  return getWish(id)
}

export function deleteWish(id) {
  db.prepare('DELETE FROM wish_items WHERE id = ?').run(id)
}

// —— 时间胶囊 ——
export function createCapsule({ authorId, title, content, photoUrl, unlockDate }) {
  const id = newId('tc')
  db.prepare('INSERT INTO time_capsules (id, author_id, title, content, photo_url, unlock_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, authorId, title || '', content, photoUrl || '', unlockDate)
  return getCapsule(id)
}

export function getCapsule(id) {
  const c = db.prepare('SELECT * FROM time_capsules WHERE id = ?').get(id)
  if (c) c.author = getUser(c.author_id)
  return c
}

export function listCapsules() {
  return db.prepare('SELECT * FROM time_capsules ORDER BY unlock_date ASC, datetime(created_at) DESC').all()
    .map((c) => ({ ...c, author: getUser(c.author_id) }))
}

export function deleteCapsule(id) {
  db.prepare('DELETE FROM time_capsules WHERE id = ?').run(id)
}

// —— 纪念日 ——
export function createAnniversary({ title, type, date, description }) {
  const id = newId('ann')
  db.prepare('INSERT INTO anniversaries (id, title, type, date, description) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, type || 'custom', date, description || '')
  return getAnniversary(id)
}

export function getAnniversary(id) {
  return db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(id)
}

export function listAnniversaries() {
  return db.prepare('SELECT * FROM anniversaries ORDER BY date ASC').all()
}

export function updateAnniversary(id, { title, type, date, description }) {
  db.prepare(
    'UPDATE anniversaries SET title = COALESCE(?, title), type = COALESCE(?, type), date = COALESCE(?, date), description = COALESCE(?, description) WHERE id = ?'
  ).run(title ?? null, type ?? null, date ?? null, description ?? null, id)
  return getAnniversary(id)
}

export function deleteAnniversary(id) {
  db.prepare('DELETE FROM anniversaries WHERE id = ?').run(id)
}

// —— 分享令牌 ——
export function createShareToken({ token, password, expiresAt }) {
  db.prepare('DELETE FROM share_tokens WHERE status = 1') // 同时仅一个有效分享
  const id = newId('st')
  db.prepare('INSERT INTO share_tokens (id, token, password, expires_at, view_count, status) VALUES (?, ?, ?, ?, 0, 1)')
    .run(id, token, password || '', expiresAt || null)
  return db.prepare('SELECT * FROM share_tokens WHERE id = ?').get(id)
}

export function getActiveShareToken() {
  return db.prepare('SELECT * FROM share_tokens WHERE status = 1').get() || null
}

export function getShareTokenByToken(token) {
  return db.prepare('SELECT * FROM share_tokens WHERE token = ?').get(token) || null
}

export function disableShareToken() {
  db.prepare('UPDATE share_tokens SET status = 0 WHERE status = 1').run()
}

export function incrementViewCount(token) {
  db.prepare('UPDATE share_tokens SET view_count = view_count + 1 WHERE token = ?').run(token)
}

// —— 统计（Dashboard / 恋爱树）——
export function stats() {
  const one = (sql, ...args) => db.prepare(sql).get(...args).c
  return {
    moments: one('SELECT COUNT(*) AS c FROM moments'),
    photos: one('SELECT COUNT(*) AS c FROM moment_photos') + one('SELECT COUNT(*) AS c FROM album_photos'),
    letters: one('SELECT COUNT(*) AS c FROM love_letters'),
    unreadLetters: one('SELECT COUNT(*) AS c FROM love_letters WHERE is_read = 0'),
    entries: one('SELECT COUNT(*) AS c FROM entries'),
    wishesTodo: one("SELECT COUNT(*) AS c FROM wish_items WHERE status = 'todo'"),
    wishesDoing: one("SELECT COUNT(*) AS c FROM wish_items WHERE status = 'doing'"),
    wishesDone: one("SELECT COUNT(*) AS c FROM wish_items WHERE status = 'done'"),
    capsules: one('SELECT COUNT(*) AS c FROM time_capsules'),
    anniversaries: one('SELECT COUNT(*) AS c FROM anniversaries'),
  }
}

export function daysSincePaired() {
  // 只有真正配对（两人都在）后才开始计算相识天数
  if (userCount() < 2) return 0
  const row = db.prepare('SELECT MIN(paired_at) AS t FROM users WHERE paired_at IS NOT NULL').get()
  if (!row?.t) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(row.t).getTime()) / 86400000))
}

export function pairStartedAt() {
  // 只有真正配对（两人都在）后才返回配对起点
  if (userCount() < 2) return null
  const row = db.prepare('SELECT MIN(paired_at) AS t FROM users WHERE paired_at IS NOT NULL').get()
  return row?.t || null
}

// 本地时区的今天（YYYY-MM-DD），纪念日/胶囊等日期比较统一用它
export function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function entriesByMonth(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-31`
  const rows = db.prepare(
    "SELECT * FROM entries WHERE date(created_at) BETWEEN ? AND ? ORDER BY datetime(created_at) DESC"
  ).all(start, end)
  return rows.map(attachContents)
}
