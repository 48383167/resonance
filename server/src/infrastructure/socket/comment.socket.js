import { getIO } from './index.js'

// 评论业务事件：向情侣空间房间 couple:{coupleId} 广播
export function emitCommentCreated(coupleId, comment) {
  getIO()?.to(`couple:${coupleId}`).emit('comment:created', comment)
}

export function emitCommentDeleted(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('comment:deleted', payload)
}
