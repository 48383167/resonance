import { getUserCouple } from '../couple/couple.service.js'
import * as navigationRepository from './navigation.repository.js'
import * as navigationSchema from './navigation.schema.js'
import { emitNavigationUpdated } from '../../infrastructure/socket/navigation.socket.js'

// 底部导航为两人共用的统一设置（singleton），任何一方修改后实时同步
export function getSettings() {
  return { items: navigationRepository.getItems() || navigationRepository.DEFAULT_NAV_ITEMS }
}

export function updateSettings(userId, raw) {
  const items = navigationSchema.validateItems(raw)
  navigationRepository.saveItems(items)
  const couple = getUserCouple(userId)
  if (couple) emitNavigationUpdated(couple.pairCode, { items })
  return { items }
}
