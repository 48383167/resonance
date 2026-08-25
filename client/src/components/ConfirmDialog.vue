<script setup>
import { computed, ref, watch } from 'vue'
import { confirmState } from '../stores/confirm'

const inputEl = ref(null)
const confirmed = computed(() =>
  !confirmState.requireText || confirmState.inputValue.trim() === confirmState.requireText)

function answer(v) {
  if (v && !confirmed.value) return
  confirmState.open = false
  confirmState.resolve?.(v)
}

watch(() => confirmState.open, (open) => {
  const onKey = (e) => {
    if (e.key === 'Escape') answer(false)
    else if (e.key === 'Enter' && !confirmState.requireText) answer(true)
  }
  if (open) {
    window.addEventListener('keydown', onKey)
    setTimeout(() => inputEl.value?.focus(), 50)
  } else {
    window.removeEventListener('keydown', onKey)
  }
})
</script>

<template>
  <Transition name="cd">
    <div v-if="confirmState.open" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      @click.self="answer(false)">
      <div class="glass w-full max-w-sm p-6 text-center fade-up">
        <div class="text-3xl">{{ confirmState.danger ? '🥀' : '✨' }}</div>
        <h3 class="serif mt-2 text-lg font-semibold">{{ confirmState.title }}</h3>
        <p class="mt-2 whitespace-pre-wrap text-sm text-white/60">{{ confirmState.message }}</p>

        <!-- 高危操作：输入名称解锁删除按钮 -->
        <div v-if="confirmState.requireText" class="mt-4 text-left">
          <label class="mb-1 block text-xs text-white/50">
            请输入 <b class="text-rose-300">{{ confirmState.requireText }}</b> 以确认删除
          </label>
          <input ref="inputEl" v-model="confirmState.inputValue" class="input-dark" autocomplete="off"
            :placeholder="confirmState.requireText" @keyup.enter="answer(true)" />
        </div>

        <div class="mt-5 flex justify-center gap-3">
          <button class="btn-ghost flex-1" @click="answer(false)">再想想</button>
          <button class="btn-primary flex-1"
            :class="{ 'opacity-40': !confirmed }"
            :style="confirmState.danger ? 'background: linear-gradient(135deg,#fb7185,#f43f5e); box-shadow: 0 4px 24px rgba(244,63,94,.35)' : ''"
            @click="answer(true)">{{ confirmState.danger ? '确认删除' : '确认' }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.cd-enter-active, .cd-leave-active { transition: opacity 0.2s ease; }
.cd-enter-from, .cd-leave-to { opacity: 0; }
</style>
