<script setup>
import { nextTick, onMounted, onUnmounted, ref, useId } from 'vue'

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
const listId = useId()
const trigger = ref(null)

const current = () => props.options.find((o) => o.value === props.modelValue)

function pick(o) {
  emit('update:modelValue', o.value)
  open.value = false
  trigger.value?.focus()
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

async function onKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    trigger.value?.focus()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (!open.value) await toggle()
  await nextTick()
  const options = [...rootEl.value.querySelectorAll('[role="option"]')]
  const index = options.indexOf(document.activeElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
    : index < 0 ? Math.max(0, props.options.findIndex((option) => option.value === props.modelValue))
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
  options[next]?.focus()
}

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}

function reposition() {
  if (!open.value) return
  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect) return
  const spaceBelow = window.innerHeight - rect.bottom
  direction.value = spaceBelow < 240 && rect.top > spaceBelow ? 'up' : 'down'
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('resize', reposition)
  window.addEventListener('scroll', reposition, true)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', reposition)
  window.removeEventListener('scroll', reposition, true)
})
</script>

<template>
  <div ref="rootEl" class="relative" @keydown="onKeydown" @focusout="!rootEl.contains($event.relatedTarget) && (open = false)">
    <button ref="trigger" type="button" @click="toggle" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="listId"
      class="input-dark flex items-center justify-between gap-2 text-left">
      <span class="flex items-center gap-2">
        <span v-if="current()?.icon">{{ current().icon }}</span>
        <span :class="current() ? '' : 'text-white/40'">{{ current()?.label || placeholder }}</span>
      </span>
      <span class="text-xs text-white/40 transition-transform" :class="open ? 'rotate-180' : ''">▾</span>
    </button>
    <Transition name="dd">
      <div v-if="open" :id="listId" role="listbox" :aria-label="placeholder"
         class="theme-popup absolute z-[65] max-h-[min(14rem,50dvh)] w-full overflow-y-auto overscroll-contain rounded-xl border border-white/15 p-1 shadow-2xl backdrop-blur-xl"
         :class="direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'">
        <button v-for="o in options" :key="o.value" type="button" role="option" :aria-selected="o.value === modelValue"
          class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
          :class="o.value === modelValue ? 'bg-accent-soft text-accent' : 'text-theme-primary'"
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
