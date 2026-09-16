import { getIO } from './index.js'

// 个人资料（性别成对同步）：向情侣空间房间 couple:{coupleId} 广播
export function emitProfileUpdated(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('profile:updated', payload)
}
