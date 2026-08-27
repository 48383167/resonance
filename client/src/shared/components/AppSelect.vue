<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

// 主题化下拉选择器（替代原生 select）
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label, icon? }]
  placeholder: { type: String, default: '请选择' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const rootEl = ref(null)
const direction = ref('down')

const current = () => props.options.find((o) => o.value === props.modelValue)

function pick(o) {
  emit('update:modelValue', o.value)
  open.value = false
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect) return
  const spaceBelow = window.innerHeight - rect.bottom
  direction.value = spaceBelow < 240 && rect.top > spaceBelow ? 'up' : 'down'
}

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="rootEl" class="relative">
    <button type="button" @click="toggle"
      class="input-dark flex items-center justify-between gap-2 text-left">
      <span class="flex items-center gap-2">
        <span v-if="current()?.icon">{{ current().icon }}</span>
        <span :class="current() ? '' : 'text-white/40'">{{ current()?.label || placeholder }}</span>
      </span>
      <span class="text-xs text-white/40 transition-transform" :class="open ? 'rotate-180' : ''">▾</span>
    </button>
    <Transition name="dd">
      <div v-if="open"
         class="theme-popup absolute z-30 max-h-[min(14rem,50dvh)] w-full overflow-y-auto rounded-xl border border-white/15 p-1 shadow-2xl backdrop-blur-xl"
         :class="direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'">
        <button v-for="o in options" :key="o.value" type="button"
          class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
          :class="o.value === modelValue ? 'bg-accent-soft text-accent' : 'text-white/80'"
          @click="pick(o)">
          <span v-if="o.icon">{{ o.icon }}</span>{{ o.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style>
.dd-enter-active, .dd-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dd-enter-from, .dd-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
