<script setup>
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { lockBodyScroll } from '../../../utils/scrollLock'

// 全屏评论编辑器：手机端全屏、桌面端居中弹窗，打开期间跟随 visualViewport 适配软键盘
const props = defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
  replyToName: { type: String, default: '' },
  submitting: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'submit', 'close'])

const panelRef = ref(null)
const textareaRef = ref(null)
const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false
let releaseScroll = () => {}
let onKey = null
let focusTimer = null

// 手机端键盘弹起时，用可视视口高度和偏移让输入区始终贴在键盘上方
function syncViewport() {
  const el = panelRef.value
  if (!el) return
  const viewport = window.visualViewport
  if (!viewport || window.matchMedia('(min-width: 640px)').matches) {
    el.style.height = ''
    el.style.transform = ''
    return
  }
  el.style.height = `${Math.round(viewport.height)}px`
  el.style.transform = `translateY(${Math.round(viewport.offsetTop)}px)`
}

function lockBody() {
  releaseScroll = lockBodyScroll()
  onKey = (e) => { if (e.key === 'Escape') emit('close') }
  window.addEventListener('keydown', onKey)
  window.visualViewport?.addEventListener('resize', syncViewport)
  window.visualViewport?.addEventListener('scroll', syncViewport)
}

function unlockBody() {
  if (onKey) window.removeEventListener('keydown', onKey)
  onKey = null
  releaseScroll()
  window.visualViewport?.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('scroll', syncViewport)
}

function onEnter(event) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.shiftKey || isTouchDevice) return
  event.preventDefault()
  emit('submit')
}

watch(() => props.open, (open) => {
  if (open) {
    lockBody()
    nextTick(() => {
      syncViewport()
      focusTimer = window.setTimeout(() => textareaRef.value?.focus(), 50)
    })
  } else {
    clearTimeout(focusTimer)
    unlockBody()
  }
})

onUnmounted(() => {
  clearTimeout(focusTimer)
  unlockBody()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ccs">
      <div v-if="open" class="ccs-backdrop" @click.self="emit('close')">
        <div ref="panelRef" class="ccs-panel">
          <header class="flex items-center gap-3 border-b border-theme px-4 py-3">
            <button type="button" class="tap-y shrink-0 text-sm text-theme-tertiary transition-colors hover-text-accent"
              @click="emit('close')">取消</button>
            <p class="min-w-0 flex-1 truncate text-center text-sm font-medium">
              {{ replyToName ? `回复 @${replyToName}` : '发表评论' }}
            </p>
            <button type="button" class="btn-primary !min-h-11 shrink-0 !px-4 !py-1.5 text-sm"
              :disabled="!modelValue.trim() || submitting" @click="emit('submit')">
              {{ submitting ? '发送中…' : '发送' }}
            </button>
          </header>
          <textarea ref="textareaRef" :value="modelValue" maxlength="500" class="ccs-textarea"
            :placeholder="replyToName ? `回复 @${replyToName}…` : '写下你的评论…'"
            :enterkeyhint="isTouchDevice ? 'enter' : 'send'" @input="emit('update:modelValue', $event.target.value)"
            @keydown.enter="onEnter" />
          <footer class="flex items-center justify-between gap-3 px-4 py-2 text-[11px] text-theme-tertiary">
            <span class="truncate">{{ isTouchDevice ? 'Enter 换行，点右上角发送' : 'Enter 发送，Shift + Enter 换行' }}</span>
            <span class="shrink-0">{{ modelValue.length }}/500</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ccs-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgb(0 0 0 / 0.6);
}

.ccs-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--page-bg);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.ccs-textarea {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  resize: none;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  padding: 1rem;
  font-size: 1rem;
  line-height: 1.7;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.ccs-textarea::-webkit-scrollbar { display: none; }
.ccs-textarea::placeholder { color: rgb(var(--text-secondary-rgb) / 0.58); }

.ccs-enter-active,
.ccs-leave-active { transition: opacity 0.22s ease; }
.ccs-enter-from,
.ccs-leave-to { opacity: 0; }

@media (min-width: 640px) {
  .ccs-backdrop {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .ccs-panel {
    height: auto;
    min-height: 24rem;
    max-width: 40rem;
    max-height: calc(100svh - 4rem);
    border: 1px solid rgb(var(--border-subtle-rgb) / var(--glass-border-alpha));
    border-radius: 1.25rem;
    box-shadow: 0 8px 28px rgb(var(--shadow-rgb) / var(--shadow-alpha));
    padding: 0;
  }
  .ccs-textarea { min-height: 18rem; font-size: 0.875rem; }
}
</style>
