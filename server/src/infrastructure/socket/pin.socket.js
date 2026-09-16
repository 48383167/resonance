import { getIO } from './index.js'

// 置顶业务事件：向情侣空间房间 couple:{coupleId} 广播
export function emitPinUpdated(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('pin:updated', payload)
}
