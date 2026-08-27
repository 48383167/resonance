<script setup>
import { onUnmounted, watch } from 'vue'
import { lightbox, closeLightbox, stepLightbox } from '../../stores/lightbox'

let onKey = null
let previousOverflow = ''

function unlockBody() {
  if (onKey) window.removeEventListener('keydown', onKey)
  onKey = null
  document.body.style.overflow = previousOverflow
}

watch(() => lightbox.open, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowLeft') stepLightbox(-1)
      else if (e.key === 'ArrowRight') stepLightbox(1)
    }
    window.addEventListener('keydown', onKey)
  } else {
    unlockBody()
  }
})

onUnmounted(unlockBody)
</script>

<template>
  <Transition name="lb">
    <div v-if="lightbox.open" class="theme-inverse image-lightbox fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 sm:p-6"
      @click.self="closeLightbox">
      <button class="lightbox-close absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 sm:right-5 sm:top-5"
        aria-label="关闭图片预览"
        @click="closeLightbox">×</button>
      <button v-if="lightbox.images.length > 1"
        class="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 sm:left-4"
        aria-label="上一张"
        @click="stepLightbox(-1)">‹</button>
      <img :src="lightbox.images[lightbox.index]" class="lightbox-image max-h-full max-w-full rounded-xl object-contain"
        @click="closeLightbox" />
      <button v-if="lightbox.images.length > 1"
        class="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 sm:right-4"
        aria-label="下一张"
        @click="stepLightbox(1)">›</button>
      <div v-if="lightbox.images.length > 1"
        class="lightbox-counter absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
        {{ lightbox.index + 1 }} / {{ lightbox.images.length }}
      </div>
    </div>
  </Transition>
</template>

<style>
.lightbox-close { top: max(1rem, env(safe-area-inset-top)); right: max(1rem, env(safe-area-inset-right)); }
.lightbox-counter { bottom: max(1rem, env(safe-area-inset-bottom)); }
.lb-enter-active, .lb-leave-active { transition: opacity 0.25s ease; }
.lb-enter-from, .lb-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .lightbox-image {
    max-height: calc(100svh - 7rem);
    max-width: calc(100vw - 5.5rem);
  }
}
</style>
