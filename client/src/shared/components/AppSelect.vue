<script setup>
import { computed } from 'vue'
import { usePopupAnchor } from '../../composables/usePopupAnchor'

// 主题化下拉选择器（替代原生 select）
// 弹层 Teleport 到 body 并用 fixed 定位：避免玻璃卡 backdrop-filter 造成的层叠遮挡
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label, icon? }]
  placeholder: { type: String, default: '请选择' },
})
const emit = defineEmits(['update:modelValue'])

const { open, anchorEl, position, close, toggle } = usePopupAnchor({
  estimateHeight: 240,
  estimateWidth: (rect) => rect.width,
})

const popupStyle = computed(() => ({
  left: `${position.value.left}px`,
  ...(position.value.top != null ? { top: `${position.value.top}px` } : { bottom: `${position.value.bottom}px` }),
  width: `${position.value.width}px`,
}))

const current = () => props.options.find((o) => o.value === props.modelValue)

function pick(o) {
  emit('update:modelValue', o.value)
  close()
}
</script>

<template>
  <div ref="anchorEl" class="relative">
    <button type="button" @click="toggle"
      class="input-dark flex items-center justify-between gap-2 text-left">
      <span class="flex items-center gap-2">
        <span v-if="current()?.icon">{{ current().icon }}</span>
        <span :class="current() ? '' : 'text-white/40'">{{ current()?.label || placeholder }}</span>
      </span>
      <span class="text-xs text-white/40 transition-transform" :class="open ? 'rotate-180' : ''">▾</span>
    </button>
  </div>

  <Teleport to="body">
    <Transition name="dd">
      <div v-if="open" data-popup
         class="theme-popup fixed z-[68] max-h-[min(14rem,50dvh)] overflow-y-auto rounded-xl border border-white/15 p-1 shadow-2xl backdrop-blur-xl"
         :style="popupStyle">
        <button v-for="o in options" :key="o.value" type="button"
          class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
          :class="o.value === modelValue ? 'bg-accent-soft text-accent' : 'text-white/80'"
          @click="pick(o)">
          <span v-if="o.icon">{{ o.icon }}</span>{{ o.label }}
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.dd-enter-active, .dd-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dd-enter-from, .dd-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
