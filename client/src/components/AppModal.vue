<script setup>
import { watch } from 'vue'

// 主题化弹窗：外层滚动容器保证内容不顶出视口，Esc/点击遮罩关闭
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: 'max-w-lg' },
  maskClosable: { type: Boolean, default: true }, // 是否允许点击背景关闭
  flush: { type: Boolean, default: false }, // 内容区无内边距（用于信纸等需要填满的场景）
})
const emit = defineEmits(['close'])

watch(() => props.open, (open) => {
  const onKey = (e) => { if (e.key === 'Escape' && props.maskClosable) emit('close') }
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Transition name="am">
    <div v-if="open" class="fixed inset-0 z-40 overflow-y-auto bg-black/60 backdrop-blur-sm" 
         @click.self="maskClosable && emit('close')">
      <!-- m-auto 居中：内容短时居中，内容长时从顶部自然展开，避免「固定窗体内滚动」 -->
      <div class="flex min-h-screen justify-center p-4">
        <div class="glass am-panel m-auto w-full overflow-hidden p-0" :class="width">
          <!-- 页头 -->
          <div v-if="title"
            class="flex items-center justify-between border-b border-white/10 px-6 py-4"
            style="background: linear-gradient(135deg, rgba(216,167,255,0.10), rgba(126,200,255,0.08))">
            <h3 class="serif flex items-center gap-2 text-lg font-semibold">
              <span class="h-4 w-1 rounded-full" style="background: linear-gradient(180deg,#d8a7ff,#7ec8ff)" />
              {{ title }}
            </h3>
            <button class="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg transition-colors hover:bg-white/20"
              @click="emit('close')">×</button>
          </div>
          <!-- 内容 -->
          <div :class="flush ? 'p-0' : 'p-6'">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.am-enter-active, .am-leave-active { transition: opacity 0.22s ease; }
.am-enter-from, .am-leave-to { opacity: 0; }
.am-enter-active .am-panel { animation: am-pop 0.24s ease; }
@keyframes am-pop {
  from { transform: translateY(14px) scale(0.98); opacity: 0; }
  to { transform: none; opacity: 1; }
}
</style>
