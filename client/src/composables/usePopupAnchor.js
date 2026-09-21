import { onMounted, onUnmounted, ref } from 'vue'

// 浮层锚定（配合 Teleport 到 body 使用）：
//   - 打开时按触发器位置计算 fixed 坐标，下方空间不足则向上弹
//   - 滚动时关闭（避免跟随抖动的复杂度）；缩放时重算
//   - 点击「触发器或弹层之外」关闭；Esc 关闭
// 说明：`.glass` 的 backdrop-filter 与页面根 .fade-up 的 transform 都会创建层叠上下文，
// 卡内 absolute 弹层永远无法盖过后续卡片或 App 级固定层（Dock），故必须 Teleport。
export function usePopupAnchor({ gap = 6, estimateHeight = 260, estimateWidth = (rect) => rect.width } = {}) {
  const open = ref(false)
  const anchorEl = ref(null)
  const position = ref({ left: 0, top: 0, bottom: null, width: 0 })

  function place() {
    const el = anchorEl.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const height = typeof estimateHeight === 'function' ? estimateHeight() : estimateHeight
    const width = estimateWidth(rect)
    const up = spaceBelow < height + gap + 8 && rect.top > spaceBelow
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
    position.value = up
      ? { left, top: null, bottom: window.innerHeight - rect.top + gap, width }
      : { left, top: rect.bottom + gap, bottom: null, width }
  }

  function close() {
    open.value = false
  }

  function toggle() {
    open.value = !open.value
    if (open.value) place()
  }

  function onDocClick(event) {
    if (anchorEl.value?.contains(event.target)) return
    // 弹层被 Teleport 到 body：通过 data-popup 标记判断点击是否落在弹层内
    if (event.target instanceof Element && event.target.closest('[data-popup]')) return
    close()
  }

  function onScroll(event) {
    // 弹层内部滚动（如分类列表、日期网格）不应关闭弹层；页面滚动才关闭
    if (event.target instanceof Element && event.target.closest('[data-popup]')) return
    if (open.value) close()
  }

  function onResize() {
    if (open.value) place()
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close()
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeydown)
  })
  onUnmounted(() => {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeydown)
  })

  return { open, anchorEl, position, place, close, toggle }
}
