<script setup>
import { onUnmounted, watch } from 'vue'

// 主题化弹窗：外层滚动容器保证内容不顶出视口，Esc/点击遮罩关闭
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: 'max-w-lg' },
  maskClosable: { type: Boolean, default: true }, // 是否允许点击背景关闭
  flush: { type: Boolean, default: false }, // 内容区无内边距（用于信纸等需要填满的场景）
})
const emit = defineEmits(['close'])
let onKey = null
let previousOverflow = ''

function unlockBody() {
  if (onKey) window.removeEventListener('keydown', onKey)
  onKey = null
  document.body.style.overflow = previousOverflow
}

watch(() => props.open, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    onKey = (e) => { if (e.key === 'Escape' && props.maskClosable) emit('close') }
    window.addEventListener('keydown', onKey)
  } else {
    unlockBody()
  }
})

onUnmounted(unlockBody)
</script>

<template>
  <Transition name="am">
    <div v-if="open" class="am-backdrop fixed inset-0 z-40 overflow-y-auto bg-black/60 backdrop-blur-sm"
         @click.self="maskClosable && emit('close')">
      <!-- m-auto 居中：内容短时居中，内容长时从顶部自然展开，避免「固定窗体内滚动」 -->
      <div class="flex min-h-[100svh] items-start justify-center sm:items-center">
        <div class="glass am-panel m-auto w-full overflow-y-auto p-0" :class="width">
          <!-- 页头 -->
          <div v-if="title"
            class="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6"
            style="background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.10), rgb(var(--accent-2-rgb) / 0.08))">
            <h3 class="serif flex min-w-0 items-center gap-2 text-lg font-semibold">
              <span class="h-4 w-1 rounded-full" style="background: linear-gradient(180deg,var(--accent),var(--accent-2))" />
              <span class="break-words">{{ title }}</span>
            </h3>
            <button class="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg transition-colors hover:bg-white/20"
              @click="emit('close')">×</button>
          </div>
          <!-- 内容 -->
          <div :class="flush ? 'p-0' : 'p-4 sm:p-6'">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.am-backdrop {
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}

.am-panel { max-height: calc(100svh - 2rem); }
.am-enter-active, .am-leave-active { transition: opacity 0.22s ease; }
.am-enter-from, .am-leave-to { opacity: 0; }
.am-enter-active .am-panel { animation: am-pop 0.24s ease; }
@keyframes am-pop {
  from { transform: translateY(14px) scale(0.98); opacity: 0; }
  to { transform: none; opacity: 1; }
}

@media (max-width: 640px) {
  .am-panel { max-height: calc(100svh - 1rem); }
}
</style>
