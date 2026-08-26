<script setup>
// 天气选择器：手动选择（v-model 为 WMO 天气代码，可为 null 表示未选）
const props = defineProps({
  modelValue: { type: Number, default: null },
})
const emit = defineEmits(['update:modelValue'])

const WEATHERS = [
  { code: 0, emoji: '☀️', label: '晴' },
  { code: 1, emoji: '⛅', label: '多云' },
  { code: 3, emoji: '☁️', label: '阴' },
  { code: 45, emoji: '🌫️', label: '雾' },
  { code: 51, emoji: '🌦️', label: '毛毛雨' },
  { code: 61, emoji: '🌧️', label: '雨' },
  { code: 71, emoji: '❄️', label: '雪' },
  { code: 95, emoji: '⛈️', label: '雷暴' },
]

function pick(w) {
  // 再点一次取消选择（天气可留空）
  emit('update:modelValue', props.modelValue === w.code ? null : w.code)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button v-for="w in WEATHERS" :key="w.code" type="button"
      class="rounded-full px-3.5 py-1.5 text-sm transition-all"
      :class="modelValue === w.code ? 'bg-accent-soft ring-1 ring-accent' : 'bg-white/5 hover:bg-white/10'"
      @click="pick(w)">
      {{ w.emoji }} {{ w.label }}
    </button>
  </div>
</template>
