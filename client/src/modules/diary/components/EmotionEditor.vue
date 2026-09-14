<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useEmotion, emotionSummary } from '../../../composables/useEmotion'

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
const { metrics, onInput, setInitialValue } = useEmotion()

const summary = computed(() => emotionSummary(metrics))
const draftStorageKey = () => props.draftKey ? `resonance.draft.${props.draftKey}` : ''

let composing = false
let draftTimer = null
let draftCleared = false

onMounted(() => {
  if (!props.draftKey) return
  try {
    const raw = localStorage.getItem(draftStorageKey())
    if (raw) {
      const d = JSON.parse(raw)
      if (d.content) {
        setContent(d.content)
        emit('restore', d)
      }
    }
  } catch { /* 忽略损坏的草稿 */ }
})

onUnmounted(() => {
  clearTimeout(draftTimer)
  persistDraft()
})

function persistDraft() {
  if (!props.draftKey || draftCleared) return
  try {
    localStorage.setItem(draftStorageKey(), JSON.stringify({ content: text.value, at: Date.now() }))
  } catch { /* 隐私模式或存储配额不足时不影响写作 */ }
}

function handleInput() {
  // 中文输入法组合期间不采集、不落盘，避免把拼音中间态写进草稿
  if (composing) return
  onInput(text.value)
  clearTimeout(draftTimer)
  draftTimer = window.setTimeout(persistDraft, 400)
}

function onCompositionStart() {
  composing = true
}

function onCompositionEnd() {
  composing = false
  handleInput()
}

function setContent(value, savedMetrics = {}) {
  text.value = String(value || '')
  setInitialValue(text.value, savedMetrics)
}

function clearDraft() {
  draftCleared = true
  if (props.draftKey) {
    try {
      localStorage.removeItem(draftStorageKey())
    } catch { /* 忽略 */ }
  }
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

defineExpose({ clearDraft, setContent })
</script>

<template>
  <div class="glass p-5">
    <div class="mb-2 flex flex-col items-start gap-2 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
      <span class="break-words">{{ hint || '情绪墨水正在采集：打字速度 · 删改 · 停顿' }}</span>
      <span class="inline-block rounded-full bg-white/10 px-3 py-1" v-if="metrics.wpm || metrics.backspaceCount">
        {{ summary }}
      </span>
    </div>
    <textarea v-model="text" @input="handleInput" :disabled="disabled"
      @compositionstart="onCompositionStart" @compositionend="onCompositionEnd"
      enterkeyhint="done"
      class="focus-ring-accent w-full resize-none rounded-xl bg-white/5 p-4 outline-none disabled:opacity-50"
      :placeholder="placeholder" rows="8" />
    <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span class="text-xs text-white/40">
        {{ text.length }} 字
        <template v-if="draftKey"> · 草稿自动保存</template>
      </span>
      <button class="btn-primary w-full sm:w-auto" :disabled="disabled || !text.trim()" @click="doSubmit">{{ submitText }}</button>
    </div>
  </div>
</template>
