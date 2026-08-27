<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { confirmState } from '../../stores/confirm'

const inputEl = ref(null)
let onKey = null
let previousOverflow = ''
const confirmed = computed(() =>
  !confirmState.requireText || confirmState.inputValue.trim() === confirmState.requireText)

function unlockBody() {
  if (onKey) window.removeEventListener('keydown', onKey)
  onKey = null
  document.body.style.overflow = previousOverflow
}

function answer(v) {
  if (v && !confirmed.value) return
  confirmState.open = false
  confirmState.resolve?.(v)
}

watch(() => confirmState.open, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    onKey = (e) => {
      if (e.key === 'Escape') answer(false)
      else if (e.key === 'Enter' && !confirmState.requireText) answer(true)
    }
    window.addEventListener('keydown', onKey)
    setTimeout(() => inputEl.value?.focus(), 50)
  } else {
    unlockBody()
  }
})

onUnmounted(unlockBody)
</script>

<template>
  <Transition name="cd">
    <div v-if="confirmState.open" class="cd-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-black/60"
      @click.self="answer(false)">
      <div class="glass max-h-[calc(100svh-2rem)] w-full max-w-sm overflow-y-auto p-5 text-center fade-up sm:p-6">
        <div class="text-3xl">{{ confirmState.danger ? '🥀' : '✨' }}</div>
        <h3 class="serif mt-2 text-lg font-semibold">{{ confirmState.title }}</h3>
        <p class="mt-2 break-words whitespace-pre-wrap text-sm text-white/60">{{ confirmState.message }}</p>

        <!-- 高危操作：输入名称解锁删除按钮 -->
        <div v-if="confirmState.requireText" class="mt-4 text-left">
          <label class="mb-1 block text-xs text-white/50">
            请输入 <b class="text-rose-300">{{ confirmState.requireText }}</b> 以确认删除
          </label>
          <input ref="inputEl" v-model="confirmState.inputValue" class="input-dark" autocomplete="off"
            :placeholder="confirmState.requireText" @keyup.enter="answer(true)" />
        </div>

        <div class="mt-5 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <button class="btn-ghost w-full flex-1" @click="answer(false)">再想想</button>
          <button class="btn-primary w-full flex-1"
            :class="{ 'opacity-40': !confirmed }"
            :style="confirmState.danger ? 'background: linear-gradient(135deg,#fb7185,#f43f5e); box-shadow: 0 4px 24px rgba(244,63,94,.35)' : ''"
            @click="answer(true)">{{ confirmState.danger ? '确认删除' : '确认' }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.cd-backdrop {
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}
.cd-enter-active, .cd-leave-active { transition: opacity 0.2s ease; }
.cd-enter-from, .cd-leave-to { opacity: 0; }
</style>
