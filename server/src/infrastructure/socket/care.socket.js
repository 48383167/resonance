import { getIO } from './index.js'

// 关怀档案业务事件：向情侣空间房间 couple:{coupleId} 广播
export function emitCareCreated(coupleId, careItem) {
  getIO()?.to(`couple:${coupleId}`).emit('care:created', careItem)
}

export function emitCareUpdated(coupleId, careItem) {
  getIO()?.to(`couple:${coupleId}`).emit('care:updated', careItem)
}

export function emitCareDeleted(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('care:deleted', payload)
}

export function emitCareBatchCreated(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('care:batch_created', payload)
}
