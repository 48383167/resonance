import { verifyToken } from '../../config/jwt.js'
import * as coupleService from '../../modules/couple/couple.service.js'

// Socket.IO 统一入口：在线感知（presence）+ 双人房间 couple:{pairCode}
// 业务事件（diary:created 等）由各模块 socket 文件通过 getIO() 触发。
let io = null

export function getIO() {
  return io
}

export function setupSocket(ioInstance) {
  io = ioInstance
  const identity = new Map() // socketId -> userId

  io.on('connection', (socket) => {
    // 已登录用户进入情侣空间房间
    socket.on('auth:join', ({ token } = {}) => {
      const userId = token && verifyToken(token)
      const couple = userId ? coupleService.getUserCouple(userId) : null
      if (!couple) return socket.emit('auth:error', { message: '登录已失效，请重新登录' })
      identity.set(socket.id, userId)
      socket.data.userId = userId
      socket.join(`couple:${couple.pairCode}`)
      socket.to(`couple:${couple.pairCode}`).emit('user_presence', { userId, nickname: couple.me.nickname, online: true })
    })

    socket.on('disconnect', () => {
      const userId = identity.get(socket.id)
      if (userId) {
        const couple = coupleService.getUserCouple(userId)
        if (couple) socket.to(`couple:${couple.pairCode}`).emit('user_presence', { userId, nickname: couple.me.nickname, online: false })
        identity.delete(socket.id)
      }
    })
  })
}
