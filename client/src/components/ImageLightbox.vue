<script setup>
import { watch } from 'vue'
import { lightbox, closeLightbox, stepLightbox } from '../stores/lightbox'

watch(() => lightbox.open, (open) => {
  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox()
    else if (e.key === 'ArrowLeft') stepLightbox(-1)
    else if (e.key === 'ArrowRight') stepLightbox(1)
  }
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Transition name="lb">
    <div v-if="lightbox.open" class="theme-inverse fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6"
      @click.self="closeLightbox">
      <button class="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20"
        @click="closeLightbox">×</button>
      <button v-if="lightbox.images.length > 1"
        class="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20"
        @click="stepLightbox(-1)">‹</button>
      <img :src="lightbox.images[lightbox.index]" class="max-h-full max-w-full rounded-xl object-contain"
        @click="closeLightbox" />
      <button v-if="lightbox.images.length > 1"
        class="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20"
        @click="stepLightbox(1)">›</button>
      <div v-if="lightbox.images.length > 1"
        class="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
        {{ lightbox.index + 1 }} / {{ lightbox.images.length }}
      </div>
    </div>
  </Transition>
</template>

<style>
.lb-enter-active, .lb-leave-active { transition: opacity 0.25s ease; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
</style>
