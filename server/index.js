import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { MEDIA_DIR } from './src/config/database.js'
import { setupSocket } from './src/infrastructure/socket/index.js'
import { setupResponse } from './src/common/response.js'
import { errorHandler } from './src/middleware/error.middleware.js'
import authRoutes from './src/modules/auth/auth.routes.js'
import coupleRoutes from './src/modules/couple/couple.routes.js'
import diaryRoutes from './src/modules/diary/diary.routes.js'
import timelineRoutes from './src/modules/timeline/timeline.routes.js'
import observatoryRoutes from './src/modules/observatory/observatory.routes.js'
import exportRoutes from './src/modules/export/export.routes.js'
import momentRoutes from './src/modules/moment/moment.routes.js'
import letterRoutes from './src/modules/letter/letter.routes.js'
import albumRoutes from './src/modules/album/album.routes.js'
import wishRoutes from './src/modules/wish/wish.routes.js'
import capsuleRoutes from './src/modules/capsule/capsule.routes.js'
import anniversaryRoutes from './src/modules/anniversary/anniversary.routes.js'
import shareRoutes from './src/modules/share/share.routes.js'
import miscRoutes from './src/modules/misc/misc.routes.js'
import musicRoutes from './src/modules/music/music.routes.js'
import themeRoutes from './src/modules/theme/theme.routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 4000

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
app.set('io', io)
app.disable('etag')

setupResponse(app)
app.use(express.json({ limit: '1mb' }))
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// 上传的图片（瞬间/相册/胶囊配图）
app.use('/media', express.static(MEDIA_DIR))

app.use('/api/auth', authRoutes)
app.use('/api/couple', coupleRoutes)
app.use('/api/entries', diaryRoutes)
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
app.use('/api/users/me/theme', themeRoutes)
app.use('/api', miscRoutes)

// 生产模式：托管前端构建产物（Vite 单页应用）
const distDir = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api(\/|$)|socket\.io(\/|$)|media(\/|$)).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

// 统一错误处理：必须放在所有路由之后（Express 错误中间件 4 参）
app.use(errorHandler)

setupSocket(io)

server.listen(PORT, () => {
  console.log(`♫ 共鸣 (Resonance) 已启动: http://localhost:${PORT}`)
})
