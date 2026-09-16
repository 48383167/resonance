<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { socket } from '../../../socket'
import CareList from '../components/CareList.vue'
import PeriodPanel from '../components/PeriodPanel.vue'
import RuleList from '../../rule/components/RuleList.vue'

// 小本本：档案 / 例假 / 规矩 三个 Tab，tab 与 URL query 双向同步
const route = useRoute()
const router = useRouter()

const TABS = [
  { value: 'care', label: '档案', icon: '🍽️' },
  { value: 'period', label: '例假', icon: '🌸' },
  { value: 'rule', label: '规矩', icon: '📜' },
]
const TAB_VALUES = TABS.map((t) => t.value)

const tab = ref(TAB_VALUES.includes(route.query.tab) ? route.query.tab : 'care')
const care = ref(null)
const period = ref(null)
const rule = ref(null)

watch(() => route.query.tab, (v) => {
  if (TAB_VALUES.includes(v)) tab.value = v
})

watch(tab, (v) => {
  if (route.query.tab !== v) router.replace({ query: { ...route.query, tab: v } })
})

// 实时事件只刷新当前 Tab；切换 Tab 时组件会重新挂载并自行加载
const LIVE_EVENTS = [
  'care:created', 'care:updated', 'care:deleted',
  'rule:created', 'rule:updated', 'rule:deleted',
  'pin:updated',
]

function reload() {
  if (tab.value === 'care') care.value?.load()
  else if (tab.value === 'period') period.value?.load()
  else rule.value?.load()
}

onMounted(() => LIVE_EVENTS.forEach((e) => socket.on(e, reload)))
onUnmounted(() => LIVE_EVENTS.forEach((e) => socket.off(e, reload)))
</script>

<template>
  <div class="fade-up space-y-5">
    <div>
      <h1 class="serif text-2xl">小本本</h1>
      <p class="mt-1 text-sm text-theme-secondary">关于你和 Ta 的重要小事</p>
    </div>

    <div class="surface-soft flex gap-2 overflow-x-auto rounded-2xl p-1">
      <button v-for="t in TABS" :key="t.value"
        class="min-h-11 shrink-0 flex-1 rounded-xl px-4 text-sm transition-colors"
        :class="tab === t.value ? 'bg-accent-soft text-accent' : 'text-theme-secondary'"
        @click="tab = t.value">
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <CareList v-if="tab === 'care'" ref="care" />
    <PeriodPanel v-else-if="tab === 'period'" ref="period" />
    <RuleList v-else ref="rule" />
  </div>
</template>
