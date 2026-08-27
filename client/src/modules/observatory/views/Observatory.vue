<script setup>
import { onMounted, ref } from 'vue'
import { getObservatory } from '../observatory.api.js'
import ObservatoryPhotoRain from './ObservatoryPhotoRain.vue'

// 观测台只展示情侣主动选中的真实相册照片。
const props = defineProps({
  initialData: { type: Object, default: null },
})
const photos = ref([])

async function load() {
  if (props.initialData) {
    photos.value = props.initialData.photos || []
    return
  }
  const data = await getObservatory()
  photos.value = data.photos || []
}

onMounted(load)
</script>

<template>
  <div class="fade-up">
    <header class="py-6 text-center">
      <div class="text-3xl">🔭</div>
      <h1 class="serif mt-3 text-2xl font-bold tracking-[0.3em]">观测台</h1>
      <p class="mt-2 text-sm text-white/55">把相册里的光，留给星光收藏</p>
    </header>

    <div v-if="!photos.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">🌌</div>
      <p class="mt-3">这里还没有被星光收藏的照片。</p>
    </div>
    <ObservatoryPhotoRain v-else :photos="photos" />
  </div>
</template>
