import { Router } from 'express'
import archiver from 'archiver'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DB_PATH, MEDIA_DIR } from '../db.js'

const router = Router()

// 导出时光机：database.sqlite + 媒体文件夹 → .zip
router.get('/export', (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10)
  res.attachment(`resonance-backup-${stamp}.zip`)

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', (err) => {
    console.error('[export] zip error:', err)
    res.status(500).end()
  })
  archive.pipe(res)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resonance-export-'))
  const tmpDb = path.join(tmp, 'database.sqlite')
  for (const suffix of ['', '-wal', '-shm']) {
    const src = DB_PATH + suffix
    if (fs.existsSync(src)) fs.copyFileSync(src, tmpDb + suffix)
  }
  archive.file(tmpDb, { name: 'database.sqlite' })

  if (fs.existsSync(MEDIA_DIR)) {
    archive.directory(MEDIA_DIR, 'media')
  }
  archive.finalize().then(() => fs.rmSync(tmp, { recursive: true, force: true }))
})

export default router
