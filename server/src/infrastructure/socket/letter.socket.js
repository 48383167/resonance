import { getIO } from './index.js'

// 情书事件：向情侣空间房间 couple:{coupleId} 广播
export function emitLetterReceived(coupleId, letter) {
  getIO()?.to(`couple:${coupleId}`).emit('letter:received', letter)
}
