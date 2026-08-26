import { getIO } from './index.js'

// 恋爱瞬间业务事件：向情侣空间房间 couple:{coupleId} 广播
export function emitMomentCreated(coupleId, moment) {
  getIO()?.to(`couple:${coupleId}`).emit('moment:created', moment)
}

export function emitMomentUpdated(coupleId, moment) {
  getIO()?.to(`couple:${coupleId}`).emit('moment:updated', moment)
}

export function emitMomentDeleted(coupleId, momentId) {
  getIO()?.to(`couple:${coupleId}`).emit('moment:deleted', momentId)
}
