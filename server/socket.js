import { getUser } from './db.js'
import { verifyToken } from './security.js'

// 双人实时通信（在线感知）
export function setupSocket(io) {
  // socketId -> userId
  const identity = new Map()

  io.on('connection', (socket) => {
    // 已登录用户进入双人频道
    socket.on('auth:join', ({ token } = {}) => {
      const userId = token && verifyToken(token)
      const user = userId ? getUser(userId) : null
      if (!user) return socket.emit('auth:error', { message: '登录已失效，请重新登录' })
      identity.set(socket.id, user.id)
      socket.data.userId = user.id
      socket.join(`pair:${user.pair_code}`)
      socket.to(`pair:${user.pair_code}`).emit('user_presence', { userId: user.id, nickname: user.nickname, online: true })
    })

    socket.on('disconnect', () => {
      const userId = identity.get(socket.id)
      if (userId) {
        const user = getUser(userId)
        if (user) socket.to(`pair:${user.pair_code}`).emit('user_presence', { userId, nickname: user.nickname, online: false })
        identity.delete(socket.id)
      }
    })
  })
}
