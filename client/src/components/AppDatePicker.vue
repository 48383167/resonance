<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

// 主题化日期选择器：替代原生 date 控件；v-model 为 YYYY-MM-DD，可留空
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '选择日期' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const rootEl = ref(null)
const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth()) // 0-11

watch(() => props.modelValue, (v) => {
  if (!v) return
  const [y, m] = v.split('-').map(Number)
  if (y && m) { viewYear.value = y; viewMonth.value = m - 1 }
}, { immediate: true })

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const cells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const lead = (first.getDay() + 6) % 7 // 周一为首
  const days = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const arr = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) {
    arr.push(`${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return arr
})

const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const label = computed(() => {
  if (!props.modelValue) return ''
  const [y, m, d] = props.modelValue.split('-').map(Number)
  return `${y}年${m}月${d}日`
})

function shift(n) {
  const d = new Date(viewYear.value, viewMonth.value + n, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}

function pick(day) {
  if (!day) return
  emit('update:modelValue', day)
  open.value = false
}

function clear() {
  emit('update:modelValue', '')
}

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="rootEl" class="relative">
    <button type="button" class="input-dark flex items-center justify-between gap-2 text-left"
      @click="open = !open">
      <span :class="modelValue ? 'text-white/40' : ''">📅</span>
      <span class="flex-1 truncate" :class="modelValue ? '' : 'text-white/40'">{{ label || placeholder }}</span>
      <span v-if="modelValue" class="text-xs text-white/40 hover:text-white" @click.stop="clear">×</span>
      <span class="text-xs text-white/40 transition-transform" :class="open ? 'rotate-180' : ''">▾</span>
    </button>
    <Transition name="dp">
      <div v-if="open"
         class="theme-popup absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-white/15 p-3 shadow-2xl backdrop-blur-xl">
        <div class="mb-2 flex items-center justify-between">
          <button type="button" class="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            @click="shift(-1)">‹</button>
          <span class="serif text-sm text-white/85">{{ viewYear }} 年 {{ viewMonth + 1 }} 月</span>
          <button type="button" class="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            @click="shift(1)">›</button>
        </div>
        <div class="grid grid-cols-7 gap-0.5 text-center">
          <span v-for="w in WEEKDAYS" :key="w" class="py-1 text-[11px] text-white/35">{{ w }}</span>
          <button v-for="(day, i) in cells" :key="i" type="button" :disabled="!day"
            class="aspect-square rounded-lg text-[13px] transition-colors"
            :class="[
              day ? 'text-white/80 hover:bg-accent-soft' : '',
              day === modelValue ? 'bg-accent-soft font-semibold text-accent ring-1 ring-accent' : '',
              day === todayStr && day !== modelValue ? 'ring-1 ring-accent-2' : '',
            ]"
            @click="pick(day)">
            {{ day ? Number(day.slice(8)) : '' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.dp-enter-active, .dp-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dp-enter-from, .dp-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
