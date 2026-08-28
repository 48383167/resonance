// 极简备份：将 database.sqlite 拷贝为带日期戳的副本（开发手册 §6）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataDir as settingsDataDir } from '../server/src/config/settings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dataDir = path.resolve(root, process.env.RESONANCE_DATA_DIR || settingsDataDir)
const src = path.join(dataDir, 'database.sqlite')
const backupDir = path.join(dataDir, 'backups')

if (!fs.existsSync(src)) {
  console.log('未找到 database.sqlite，跳过备份')
  process.exit(0)
}
fs.mkdirSync(backupDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)
const dest = path.join(backupDir, `database-${stamp}.sqlite`)
fs.copyFileSync(src, dest)
// WAL 模式下的增量数据一并归档
for (const suffix of ['-wal', '-shm']) {
  const s = src + suffix
  if (fs.existsSync(s)) fs.copyFileSync(s, dest + suffix)
}
console.log(`备份完成: ${dest}`)
