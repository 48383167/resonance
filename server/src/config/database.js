import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataDir as settingsDataDir } from './settings.js'

// 数据库连接与初始化：仅负责目录 / WAL / 建表 / 列迁移与连接生命周期。
// 业务 SQL 一律放入 modules/*/*.repository.js（见重构计划 §15）。
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..')
// 数据目录优先级：环境变量 > settings.js 配置 > 项目根目录；
// 相对路径基于项目根目录解析，绝对路径原样使用
export const DATA_DIR = path.resolve(PROJECT_ROOT, process.env.RESONANCE_DATA_DIR || settingsDataDir)
export const DB_PATH = path.join(DATA_DIR, 'database.sqlite')
export const MEDIA_DIR = path.join(DATA_DIR, 'media')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(MEDIA_DIR, { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA busy_timeout = 5000')

// —— 轻量事务助手：供 Service/Repository 包裹多写操作，出错回滚、成功提交 ——
// 注意：node:sqlite 为同步驱动，未提供 better-sqlite3 的 .transaction() 包装，
// 这里仅用原生 BEGIN/COMMIT/ROLLBACK 保持语义；调用方需保证不嵌套事务。
export function transaction(fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* 忽略回滚失败，保留原始异常 */ }
    throw err
  }
}

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
    avatar_url TEXT DEFAULT '',          -- 已作废：改用 avatar_file_id
    avatar_file_id TEXT,                 -- 文件表 ID（files.id）
    pair_code TEXT,
    paired_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    first_meet_at TEXT                -- 手动设置的相识日期 YYYY-MM-DD（NULL=未设置）
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
    show_in_share INTEGER NOT NULL DEFAULT 1, -- 是否在分享链接中展示（条目级）
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS moment_photos (
    id TEXT PRIMARY KEY,
    moment_id TEXT NOT NULL,
    url TEXT DEFAULT '',             -- 已作废：改用 file_id
    file_id TEXT,                    -- 文件表 ID（files.id）
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
    cover_url TEXT DEFAULT '',       -- 已作废：改用 cover_file_id
    cover_file_id TEXT,              -- 文件表 ID（files.id）
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS album_photos (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    url TEXT DEFAULT '',             -- 已作废：改用 file_id
    file_id TEXT,                    -- 文件表 ID（files.id）
    caption TEXT DEFAULT '',
    show_in_observatory INTEGER NOT NULL DEFAULT 0, -- 是否展示到观测台（仅图片）
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
    photo_url TEXT DEFAULT '',       -- 已作废：改用 photo_file_id
    photo_file_id TEXT,              -- 文件表 ID（files.id）
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
    show_in_share INTEGER NOT NULL DEFAULT 1, -- 是否在分享链接中展示（条目级）
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 文件表：每个文件的元信息（ID 为雪花 ID 十进制字符串，见 common/utils/snowflake.js）
-- path 为相对 MEDIA_DIR 的路径（yyyy/MM/dd/哈希名.ext），对外 URL = /media/{path}
-- 软删除 + 墓碑：删除时物理文件移入 .trash，status 置 0，原 URL 立即失效且文件可恢复
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT,                    -- 上传者（null = 系统/迁移）
    path TEXT NOT NULL,              -- 相对存储路径
    size INTEGER DEFAULT 0,
    mime TEXT DEFAULT '',
    original_name TEXT DEFAULT '',
    status INTEGER DEFAULT 1,        -- 1=正常 0=已删除（墓碑）
    deleted_at TEXT,
    trash_path TEXT,                 -- 墓碑路径（相对 .trash）
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
    include_moments INTEGER NOT NULL DEFAULT 1,       -- 是否分享恋爱瞬间
    include_entries INTEGER NOT NULL DEFAULT 1,       -- 是否分享公开日记
    include_anniversaries INTEGER NOT NULL DEFAULT 1, -- 是否分享纪念日
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 幂等记录：创建类 POST 接口的幂等保护（中间件 idempotency.middleware.js 使用）
-- 唯一键 (user_id, request_key, route_scope) 隔离：同用户 + 同 Idempotency-Key + 同路由作用域
CREATE TABLE IF NOT EXISTS idempotency_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    request_key TEXT NOT NULL,           -- 客户端 Idempotency-Key 请求头原值
    route_scope TEXT NOT NULL,           -- HTTP method + 路由作用域（含实际路径参数）
    request_hash TEXT NOT NULL,          -- 请求体 SHA-256 哈希（区分同 key 不同 body）
    status TEXT NOT NULL DEFAULT 'processing', -- processing=处理中 / completed=已完成
    status_code INTEGER,                 -- 首次成功响应的 HTTP 状态码
    response_body TEXT,                  -- 首次成功响应 JSON 原文（用于重放）
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    completed_at TEXT,
    UNIQUE(user_id, request_key, route_scope)
);
`)

// 老库补列：日记附件、心愿阶段时间节点、情书阅读时间、文件 ID 化新列
ensureColumns('entries', { media: "TEXT DEFAULT '[]'" })
ensureColumns('users', { avatar_file_id: 'TEXT', first_meet_at: 'TEXT' })
ensureColumns('moment_photos', { file_id: 'TEXT' })
ensureColumns('albums', { cover_file_id: 'TEXT' })
ensureColumns('album_photos', {
  file_id: 'TEXT',
  show_in_observatory: 'INTEGER NOT NULL DEFAULT 0',
})
ensureColumns('time_capsules', { photo_file_id: 'TEXT' })
ensureColumns('wish_items', {
  completed_at: 'TEXT',
  started_at: 'TEXT',
})
ensureColumns('love_letters', { read_at: 'TEXT' })
ensureColumns('moments', { show_in_share: 'INTEGER NOT NULL DEFAULT 1' })
ensureColumns('anniversaries', { show_in_share: 'INTEGER NOT NULL DEFAULT 1' })
ensureColumns('user_theme_settings', {
  appearance_mode: "TEXT NOT NULL DEFAULT 'auto'",
  surface_color: 'TEXT',
  surface_strong_color: 'TEXT',
  text_color: 'TEXT',
  muted_text_color: 'TEXT',
  border_color: 'TEXT',
})
ensureColumns('share_tokens', {
  include_moments: 'INTEGER NOT NULL DEFAULT 1',
  include_entries: 'INTEGER NOT NULL DEFAULT 1',
  include_anniversaries: 'INTEGER NOT NULL DEFAULT 1',
})
