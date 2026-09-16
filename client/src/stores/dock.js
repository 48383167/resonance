import { reactive } from 'vue'
import { getNavigation } from '../modules/navigation/navigation.api.js'
import { primaryNavigationNames } from '../shared/navigation.js'

// 底部导航为两人共用的统一设置（非按用户）；默认值与后端一致
export const DEFAULT_DOCK_ITEMS = [...primaryNavigationNames]
export const dock = reactive({ items: [...DEFAULT_DOCK_ITEMS], loaded: false })

export function applyDock(items) {
  if (Array.isArray(items) && items.length) dock.items = [...items]
}

export async function loadDock() {
  try {
    const data = await getNavigation()
    applyDock(data?.items)
    dock.loaded = true
  } catch { /* 加载失败保留默认导航 */ }
}

export function resetDock() {
  dock.items = [...DEFAULT_DOCK_ITEMS]
  dock.loaded = false
}
