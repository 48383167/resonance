import { AppError } from '../../common/errors/AppError.js'

// 合法导航入口：与前端 shared/navigation.js 的 name 一一对应
export const NAV_ITEM_NAMES = [
  'home', 'timeline', 'diary-list', 'moments', 'letters', 'companion',
  'albums', 'map', 'foods', 'wishes', 'notebook', 'capsules', 'anniversaries', 'observatory', 'settings',
]
export const MIN_NAV_ITEMS = 1
export const MAX_NAV_ITEMS = 5

export function validateItems(body = {}) {
  const { items } = body
  if (!Array.isArray(items) || items.length < MIN_NAV_ITEMS || items.length > MAX_NAV_ITEMS) {
    throw new AppError(`底部导航需要 ${MIN_NAV_ITEMS}~${MAX_NAV_ITEMS} 个入口`, 400, 'INVALID_NAV_ITEMS')
  }
  const seen = new Set()
  for (const name of items) {
    if (typeof name !== 'string' || !NAV_ITEM_NAMES.includes(name) || seen.has(name)) {
      throw new AppError('底部导航入口不合法', 400, 'INVALID_NAV_ITEMS')
    }
    seen.add(name)
  }
  return items
}
