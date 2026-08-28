import { getIO } from './index.js'

// 情侣空间基础信息变更（如相识日期）：广播给双方，对方实时刷新
export function emitCoupleUpdated(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('couple:updated', payload)
}
