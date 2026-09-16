import { onMounted, onUnmounted, ref, watch } from 'vue'

// 触底自动加载：把返回的 sentinel 放到列表底部，进入视口时回调 loadMore
// canLoadMore 返回 false 时停止观察（例如已加载完全部数据）
export function useInfiniteScroll(loadMore, canLoadMore, options = {}) {
  const sentinel = ref(null)
  let observer = null

  function observe(el) {
    if (!observer) return
    observer.disconnect()
    if (el) observer.observe(el)
  }

  onMounted(() => {
    observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && canLoadMore()) loadMore()
    }, { rootMargin: options.rootMargin || '200px' })
    observe(sentinel.value)
  })

  watch(sentinel, (el) => observe(el))
  onUnmounted(() => observer?.disconnect())

  return { sentinel }
}
