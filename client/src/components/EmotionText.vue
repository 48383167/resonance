<script setup>
import { computed } from 'vue'
import { emotionStyle, emotionSummary } from '../composables/useEmotion'

// 情绪墨水渲染：按 WPM/退格/停顿 动态呈现文字质感
const props = defineProps({
  content: { type: String, required: true },
  metrics: { type: Object, default: () => ({}) },
  color: { type: String, default: '#f4ecff' },
  compact: { type: Boolean, default: false },
})

const style = computed(() => emotionStyle(props.metrics || {}))
const lines = computed(() => props.content.split('\n'))
</script>

<template>
  <div>
    <p v-for="(line, i) in lines" :key="i" :style="{ color, ...style }"
      class="whitespace-pre-wrap leading-relaxed" :class="compact ? 'text-sm' : 'text-base'">
      {{ line || ' ' }}
    </p>
    <div v-if="metrics && (metrics.wpm || metrics.backspaceCount)" class="mt-3 text-[11px] text-white/40">
      情绪痕迹：{{ emotionSummary(metrics) }}
    </div>
  </div>
</template>
