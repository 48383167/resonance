import { getIO } from './index.js'

// 日记业务事件：向情侣空间房间 couple:{coupleId} 广播
export function emitDiaryCreated(coupleId, diary) {
  getIO()?.to(`couple:${coupleId}`).emit('diary:created', diary)
}

export function emitDiaryUpdated(coupleId, diary) {
  getIO()?.to(`couple:${coupleId}`).emit('diary:updated', diary)
}

export function emitDiaryDeleted(coupleId, diaryId) {
  getIO()?.to(`couple:${coupleId}`).emit('diary:deleted', diaryId)
}
