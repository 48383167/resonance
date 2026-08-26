<script setup>
import { computed, onMounted, ref } from 'vue'
import { useEmotion, emotionSummary } from '../composables/useEmotion'

// 情绪墨水编辑器：实时采集打字情绪；支持草稿自动保存/恢复
const props = defineProps({
  placeholder: { type: String, default: '此刻的心情是…' },
  submitText: { type: String, default: '封存此刻' },
  hint: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  draftKey: { type: String, default: '' }, // 提供则自动保存草稿
})

const emit = defineEmits(['submit', 'restore'])

const text = ref('')
const { metrics, onInput } = useEmotion()

const summary = computed(() => emotionSummary(metrics))
const draftStorageKey = () => props.draftKey ? `resonance.draft.${props.draftKey}` : ''

onMounted(() => {
  if (!props.draftKey) return
  try {
    const raw = localStorage.getItem(draftStorageKey())
    if (raw) {
      const d = JSON.parse(raw)
      if (d.content) {
        text.value = d.content
        emit('restore', d)
      }
    }
  } catch { /* 忽略损坏的草稿 */ }
})

function handleInput() {
  onInput(text.value)
  if (props.draftKey) {
    localStorage.setItem(draftStorageKey(), JSON.stringify({ content: text.value, at: Date.now() }))
  }
}

function clearDraft() {
  if (props.draftKey) localStorage.removeItem(draftStorageKey())
}

function doSubmit() {
  if (!text.value.trim() || props.disabled) return
  emit('submit', {
    content: text.value,
    typingSpeed: metrics.wpm,
    deleteCount: metrics.backspaceCount,
    pauseDuration: metrics.pauseDuration,
  })
}

defineExpose({ clearDraft })
</script>

<template>
  <div class="glass p-5">
    <div class="mb-2 flex items-center justify-between text-xs text-white/60">
      <span>{{ hint || '情绪墨水正在采集：打字速度 · 删改 · 停顿' }}</span>
      <span class="inline-block rounded-full bg-white/10 px-3 py-1" v-if="metrics.wpm || metrics.backspaceCount">
        {{ summary }}
      </span>
    </div>
    <textarea v-model="text" @input="handleInput" :disabled="disabled"
      class="focus-ring-accent w-full resize-none rounded-xl bg-white/5 p-4 outline-none disabled:opacity-50"
      :placeholder="placeholder" rows="8" />
    <div class="mt-3 flex items-center justify-between">
      <span class="text-xs text-white/40">
        {{ text.length }} 字
        <template v-if="draftKey"> · 草稿自动保存</template>
      </span>
      <button class="btn-primary" :disabled="disabled || !text.trim()" @click="doSubmit">{{ submitText }}</button>
    </div>
  </div>
</template>
