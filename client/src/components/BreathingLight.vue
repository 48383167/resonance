<script setup>
import { ref, watch } from 'vue'
import anime from 'animejs'

// 呼吸灯：常态呼吸；对方上线时泛起涟漪
const props = defineProps({
  online: { type: Boolean, default: false },
  size: { type: Number, default: 64 },
})

const ringRef = ref(null)
const coreRef = ref(null)

watch(
  () => props.online,
  (v) => {
    if (v && coreRef.value) {
      anime({ targets: coreRef.value, scale: [1, 1.25, 1], duration: 700, easing: 'easeOutQuad' })
    }
  }
)
</script>

<template>
  <div class="relative inline-flex items-center justify-center" :style="{ width: size + 'px', height: size + 'px' }">
    <div ref="ringRef" class="absolute inset-0 rounded-full border"
      :style="{ borderColor: online ? 'rgba(126,200,255,0.9)' : 'rgba(255,255,255,0.25)' }" />
    <div ref="coreRef" class="breath rounded-full"
      :style="{
        width: '62%', height: '62%',
        background: online
          ? 'radial-gradient(circle, rgba(126,200,255,0.95), rgba(126,200,255,0.25))'
          : 'radial-gradient(circle, rgba(216,167,255,0.8), rgba(216,167,255,0.15))',
        boxShadow: online ? '0 0 24px rgba(126,200,255,0.8)' : '0 0 20px rgba(216,167,255,0.5)',
      }" />
  </div>
</template>
