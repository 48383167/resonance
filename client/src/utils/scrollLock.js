let locks = 0
let previousOverflow = ''

// 多个浮层可以叠加；只有最后一个持有者关闭时才恢复页面滚动。
export function lockBodyScroll() {
  if (locks++ === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--locks === 0) document.body.style.overflow = previousOverflow
  }
}
