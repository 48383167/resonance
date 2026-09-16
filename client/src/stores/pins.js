import { reactive } from 'vue'
import { getGlobalPins } from '../modules/pin/pin.api.js'

// 全站置顶：App / 首页 / 小本本共享；置顶变化由 socket pin:updated 触发刷新
export const pins = reactive({ global: [], loaded: false })

export async function loadGlobalPins() {
  try {
    const result = await getGlobalPins()
    pins.global = result?.items || []
    pins.loaded = true
  } catch { /* 置顶加载失败不打扰主流程 */ }
}

export function resetPins() {
  pins.global = []
  pins.loaded = false
}
