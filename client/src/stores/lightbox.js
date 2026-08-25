import { reactive } from 'vue'

// 全局图片灯箱：任意模块点击图片放大浏览
export const lightbox = reactive({ open: false, images: [], index: 0 })

export function openLightbox(images, index = 0) {
  if (!images || !images.length) return
  lightbox.images = images
  lightbox.index = index
  lightbox.open = true
}

export function closeLightbox() {
  lightbox.open = false
}

export function stepLightbox(delta) {
  const n = lightbox.images.length
  if (n > 1) lightbox.index = (lightbox.index + delta + n) % n
}
