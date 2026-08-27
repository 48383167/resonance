// 一次性迁移：旧平铺媒体文件 → 年月日分级目录 + files 表 + 业务行改存文件 ID
// 用法：node server/scripts/migrate-files.js
// 幂等：已迁移（file_id 已填）的行自动跳过，可重复执行
import fs from 'node:fs'
import path from 'node:path'
import { db, MEDIA_DIR, DATA_DIR } from '../src/config/database.js'
import { generateFileId, encryptId, datePathOf } from '../src/common/utils/snowflake.js'

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp',
  webp: 'image/webp', tiff: 'image/tiff', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
}

const typeOfExt = (ext) => {
  const mime = MIME_BY_EXT[ext] || ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'file'
}

const legacyUrlOf = (url) => {
  if (!url || !url.startsWith('/media/')) return null
  return decodeURIComponent(url.replace(/^\/media\//, ''))
}

// 旧文件名格式：{Date.now()}-{原名净化}-{uuid6}{ext}
function originalNameOf(filename) {
  const ext = path.extname(filename)
  const stem = path.basename(filename, ext)
  const m = /^(\d{13})-(.+)-[0-9a-f]{6}$/.exec(stem)
  return m ? `${m[2]}${ext}` : filename
}

function timestampOf(filename) {
  const m = /^(\d{13})-/.exec(path.basename(filename))
  if (m) return Number(m[1])
  return null
}

const migrated = new Map() // 物理路径 → fileId（去重，同一文件多处引用只迁一次）

function migrateFile(legacyPath, userId) {
  const rel = legacyPath.replace(/^\/+/, '')
  const abs = path.join(MEDIA_DIR, rel)
  if (migrated.has(abs)) return migrated.get(abs)
  if (!fs.existsSync(abs)) {
    console.log(`  [跳过] 文件不存在: ${rel}`)
    return null
  }

  const filename = path.basename(rel)
  const ts = timestampOf(filename) || Math.floor(fs.statSync(abs).mtimeMs)
  const { id, ext } = generateFileId(filename, ts)
  const newRel = `${datePathOf(id)}/${encryptId(id)}.${ext}`
  const newAbs = path.join(MEDIA_DIR, newRel)
  fs.mkdirSync(path.dirname(newAbs), { recursive: true })
  fs.renameSync(abs, newAbs)

  const size = fs.statSync(newAbs).size
  db.prepare(
    `INSERT INTO files (id, user_id, path, size, mime, original_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId || null, newRel, size, MIME_BY_EXT[ext] || '', originalNameOf(filename),
    new Date(ts).toISOString())
  migrated.set(abs, id)
  console.log(`  [迁移] ${rel} → ${newRel} (id=${id})`)
  return id
}

// 遍历 MEDIA_DIR 根目录的平铺残留文件（未被业务行引用的孤儿文件也一并迁入 files 表）
function migrateStrays() {
  if (!fs.existsSync(MEDIA_DIR)) return
  const used = new Set(migrated.keys())
  const entries = fs.readdirSync(MEDIA_DIR, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isFile()) continue
    if (e.name === '.trash' || e.name.startsWith('.')) continue
    const abs = path.join(MEDIA_DIR, e.name)
    if (!used.has(abs)) migrateFile(e.name, null)
  }
}

function main() {
  console.log(`数据目录: ${DATA_DIR}`)
  console.log('开始迁移旧文件…')

  db.exec('BEGIN')
  try {
    // 1. 用户头像
    for (const u of db.prepare("SELECT id, avatar_url FROM users WHERE avatar_file_id IS NULL AND avatar_url LIKE '/media/%'").all()) {
      const legacy = legacyUrlOf(u.avatar_url)
      if (!legacy) continue
      const fileId = migrateFile(legacy, u.id)
      if (fileId) db.prepare("UPDATE users SET avatar_file_id = ?, avatar_url = '' WHERE id = ?").run(fileId, u.id)
    }

    // 2. 日记附件 JSON（旧值可能是 {url,type} 对象或 url 字符串）
    for (const e of db.prepare('SELECT id, media FROM entries').all()) {
      let items = []
      try { items = JSON.parse(e.media || '[]') } catch { /* 忽略 */ }
      if (!Array.isArray(items)) continue
      let changed = false
      const next = items.map((it) => {
        if (it && typeof it === 'object' && it.fileId) return it
        const legacy = legacyUrlOf(typeof it === 'string' ? it : (it && it.url))
        if (legacy) {
          const ext = path.extname(legacy).slice(1).toLowerCase()
          const fileId = migrateFile(legacy, null)
          if (fileId) {
            changed = true
            return { fileId, type: (it && it.type) || typeOfExt(ext) }
          }
        }
        return it
      })
      if (changed) db.prepare('UPDATE entries SET media = ? WHERE id = ?').run(JSON.stringify(next), e.id)
    }

    // 3. 瞬间照片
    for (const p of db.prepare("SELECT id, url FROM moment_photos WHERE file_id IS NULL AND url LIKE '/media/%'").all()) {
      const legacy = legacyUrlOf(p.url)
      if (!legacy) continue
      const fileId = migrateFile(legacy, null)
      if (fileId) db.prepare("UPDATE moment_photos SET file_id = ?, url = '' WHERE id = ?").run(fileId, p.id)
    }

    // 4. 相册封面
    for (const a of db.prepare("SELECT id, cover_url FROM albums WHERE cover_file_id IS NULL AND cover_url LIKE '/media/%'").all()) {
      const legacy = legacyUrlOf(a.cover_url)
      if (!legacy) continue
      const fileId = migrateFile(legacy, null)
      if (fileId) db.prepare("UPDATE albums SET cover_file_id = ?, cover_url = '' WHERE id = ?").run(fileId, a.id)
    }

    // 5. 相册照片
    for (const p of db.prepare("SELECT id, url FROM album_photos WHERE file_id IS NULL AND url LIKE '/media/%'").all()) {
      const legacy = legacyUrlOf(p.url)
      if (!legacy) continue
      const fileId = migrateFile(legacy, null)
      if (fileId) db.prepare("UPDATE album_photos SET file_id = ?, url = '' WHERE id = ?").run(fileId, p.id)
    }

    // 6. 时间胶囊配图
    for (const c of db.prepare("SELECT id, photo_url FROM time_capsules WHERE photo_file_id IS NULL AND photo_url LIKE '/media/%'").all()) {
      const legacy = legacyUrlOf(c.photo_url)
      if (!legacy) continue
      const fileId = migrateFile(legacy, null)
      if (fileId) db.prepare("UPDATE time_capsules SET photo_file_id = ?, photo_url = '' WHERE id = ?").run(fileId, c.id)
    }

    // 7. 未被引用的平铺残留文件
    migrateStrays()

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    console.error('迁移失败，已回滚数据库变更（已移动的物理文件需人工核对）:', err)
    process.exit(1)
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM files').get().c
  console.log(`迁移完成：files 表共 ${count} 条记录`)
}

main()
