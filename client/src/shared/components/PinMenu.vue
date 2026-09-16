<script setup>
import { ref } from 'vue'
import { setPin } from '../../modules/pin/pin.api.js'
import { loadGlobalPins } from '../../stores/pins'
import { toast } from '../../stores/toast'

// 置顶选择：卡片内联展开，不依赖浮层
const props = defineProps({
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  scope: { type: String, default: 'none' },
})
const emit = defineEmits(['close', 'change'])

const CHOICES = [
  { value: 'none', label: '不置顶' },
  { value: 'list', label: '列表置顶' },
  { value: 'global', label: '全站置顶' },
]
const busy = ref(false)

async function choose(scope) {
  if (busy.value) return
  busy.value = true
  try {
    await setPin({ targetType: props.targetType, targetId: props.targetId, scope })
    loadGlobalPins()
    emit('change', scope)
    emit('close')
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="surface-soft mt-3 rounded-xl p-3">
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="text-xs text-theme-tertiary">列表置顶排在本列表最前 · 全站置顶会出现在首页和顶部横幅</span>
      <button class="shrink-0 text-xs text-theme-secondary hover:text-theme-primary" @click="emit('close')">收起</button>
    </div>
    <div class="flex flex-wrap gap-2">
      <button v-for="c in CHOICES" :key="c.value" :disabled="busy"
        class="min-h-10 rounded-full border px-3 text-sm transition-colors"
        :class="c.value === scope ? 'border-accent bg-accent-soft text-accent' : 'border-theme text-theme-secondary'"
        @click="choose(c.value)">
        {{ c.value === scope ? '✓ ' : '' }}{{ c.label }}
      </button>
    </div>
  </div>
</template>
