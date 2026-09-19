import { getIO } from './index.js'

// 美食探店业务事件：向情侣空间房间 couple:{coupleId} 广播
export function emitFoodCreated(coupleId, place) {
  getIO()?.to(`couple:${coupleId}`).emit('food:created', place)
}

export function emitFoodUpdated(coupleId, place) {
  getIO()?.to(`couple:${coupleId}`).emit('food:updated', place)
}

export function emitFoodDeleted(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('food:deleted', payload)
}
