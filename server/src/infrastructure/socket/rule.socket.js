import { getIO } from './index.js'

// 相处规矩业务事件：向情侣空间房间 couple:{coupleId} 广播
export function emitRuleCreated(coupleId, rule) {
  getIO()?.to(`couple:${coupleId}`).emit('rule:created', rule)
}

export function emitRuleUpdated(coupleId, rule) {
  getIO()?.to(`couple:${coupleId}`).emit('rule:updated', rule)
}

export function emitRuleDeleted(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('rule:deleted', payload)
}

export function emitRuleAgreed(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('rule:agreed', payload)
}

export function emitRuleItemAdded(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('rule:item_added', payload)
}

export function emitRuleItemAgreed(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('rule:item_agreed', payload)
}
