import { getIO } from './index.js'

// 底部导航变更：向情侣空间房间 couple:{coupleId} 广播，双方界面实时同步
export function emitNavigationUpdated(coupleId, payload) {
  getIO()?.to(`couple:${coupleId}`).emit('navigation:updated', payload)
}
