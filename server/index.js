import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { MEDIA_DIR } from './db.js'
import { setupSocket } from './socket.js'
import authRoutes from './routes/auth.js'
import entryRoutes from './routes/entries.js'
import timelineRoutes from './routes/timeline.js'
import observatoryRoutes from './routes/observatory.js'
import exportRoutes from './routes/export.js'
import momentRoutes from './routes/moments.js'
import letterRoutes from './routes/letters.js'
import albumRoutes from './routes/albums.js'
import wishRoutes from './routes/wishes.js'
import capsuleRoutes from './routes/capsules.js'
import anniversaryRoutes from './routes/anniversaries.js'
import shareRoutes from './routes/share.js'
import miscRoutes from './routes/misc.js'
import musicRoutes from './routes/music.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 4000

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
app.set('io', io)

app.use(express.json({ limit: '1mb' }))

// 上传的图片（瞬间/相册/胶囊配图）
app.use('/media', express.static(MEDIA_DIR))

app.use('/api/auth', authRoutes)
app.use('/api/entries', entryRoutes)
app.use('/api/timeline', timelineRoutes)
app.use('/api/public', observatoryRoutes)
app.use('/api', exportRoutes)
app.use('/api/moments', momentRoutes)
app.use('/api/letters', letterRoutes)
app.use('/api/albums', albumRoutes)
app.use('/api/wishes', wishRoutes)
app.use('/api/capsules', capsuleRoutes)
app.use('/api/anniversaries', anniversaryRoutes)
app.use('/api/share', shareRoutes)
app.use('/api/music', musicRoutes)
app.use('/api', miscRoutes)

// 生产模式：托管前端构建产物（Vite 单页应用）
const distDir = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api(\/|$)|socket\.io(\/|$)|media(\/|$)).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

setupSocket(io)

server.listen(PORT, () => {
  console.log(`♫ 共鸣 (Resonance) 已启动: http://localhost:${PORT}`)
})
