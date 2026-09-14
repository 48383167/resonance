<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { confirmState } from '../../stores/confirm'
import { lockBodyScroll } from '../../utils/scrollLock'

const inputEl = ref(null)
const backdropEl = ref(null)
let onKey = null
let releaseScroll = () => {}
const confirmed = computed(() =>
  !confirmState.requireText || confirmState.inputValue.trim() === confirmState.requireText)

function unlockBody() {
  if (onKey) window.removeEventListener('keydown', onKey)
  onKey = null
  releaseScroll()
  window.visualViewport?.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('scroll', syncViewport)
}

// 软键盘弹起时让遮罩跟随可视视口，保证输入框与确认按钮可见
function syncViewport() {
  const el = backdropEl.value
  const viewport = window.visualViewport
  if (!el || !viewport) return
  el.style.height = `${Math.round(viewport.height)}px`
  el.style.transform = `translateY(${Math.round(viewport.offsetTop)}px)`
}

function answer(v) {
  if (v && !confirmed.value) return
  confirmState.open = false
  confirmState.resolve?.(v)
}

watch(() => confirmState.open, (open) => {
  if (open) {
    releaseScroll = lockBodyScroll()
    onKey = (e) => {
      if (e.key === 'Escape') answer(false)
      else if (e.key === 'Enter' && !e.isComposing && !confirmState.requireText && e.target === document.body) answer(true)
    }
    window.addEventListener('keydown', onKey)
    window.visualViewport?.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('scroll', syncViewport)
    // 在用户手势的微任务内聚焦，iOS 才会弹出键盘（setTimeout 会丢失手势）
    nextTick(() => {
      syncViewport()
      inputEl.value?.focus()
    })
  } else {
    unlockBody()
  }
})

onUnmounted(unlockBody)
</script>

<template>
  <Transition name="cd">
    <div v-if="confirmState.open" ref="backdropEl" class="cd-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-black/60"
      @click.self="answer(false)">
      <div class="glass cd-panel w-full max-w-sm overflow-y-auto overscroll-contain p-5 text-center fade-up sm:p-6" role="alertdialog" aria-modal="true" :aria-label="confirmState.title">
        <div class="text-3xl">{{ confirmState.danger ? '🥀' : '✨' }}</div>
        <h3 class="serif mt-2 text-lg font-semibold">{{ confirmState.title }}</h3>
        <p class="mt-2 break-words whitespace-pre-wrap text-sm text-white/60">{{ confirmState.message }}</p>

        <!-- 高危操作：输入名称解锁删除按钮 -->
        <div v-if="confirmState.requireText" class="mt-4 text-left">
          <label class="mb-1 block text-xs text-white/50">
            请输入 <b class="danger-link">{{ confirmState.requireText }}</b> 以确认删除
          </label>
          <input ref="inputEl" v-model="confirmState.inputValue" class="input-dark" autocomplete="off"
            autocapitalize="off" autocorrect="off" spellcheck="false"
            :placeholder="confirmState.requireText" @keyup.enter="!$event.isComposing && $event.keyCode !== 229 && answer(true)" />
        </div>

        <div class="mt-5 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <button class="btn-ghost w-full flex-1" @click="answer(false)">再想想</button>
          <button class="btn-primary w-full flex-1"
            :disabled="!confirmed"
            :style="confirmState.danger ? 'background: linear-gradient(135deg,#fb7185,#f43f5e); color: #310b17; box-shadow: 0 4px 24px rgba(244,63,94,.35)' : ''"
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
.cd-panel { max-height: 100%; background: rgb(var(--surface-2-rgb) / 0.98); }
.cd-enter-active, .cd-leave-active { transition: opacity 0.2s ease; }
.cd-enter-from, .cd-leave-to { opacity: 0; }
</style>
