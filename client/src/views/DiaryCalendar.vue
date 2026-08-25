<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { session } from '../stores/session'

// 日记日历：按月份展示有日记的日期，点日期看当天日记
const router = useRouter()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const entries = ref([])
const selectedDate = ref('')

const byDate = computed(() => {
  const map = {}
  for (const e of entries.value) {
    const d = e.created_at.slice(0, 10)
    if (!map[d]) map[d] = []
    map[d].push(e)
  }
  return map
})

const cells = computed(() => {
  const first = new Date(year.value, month.value - 1, 1)
  const startWeekday = first.getDay()
  const daysInMonth = new Date(year.value, month.value, 0).getDate()
  const arr = []
  for (let i = 0; i < startWeekday; i++) arr.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    arr.push(`${year.value}-${String(month.value).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return arr
})

async function load() {
  entries.value = await api.get(`/api/entries/calendar?year=${year.value}&month=${month.value}`)
}
onMounted(load)

function shift(delta) {
  let m = month.value + delta
  let y = year.value
  if (m < 1) { m = 12; y-- }
  if (m > 12) { m = 1; y++ }
  month.value = m
  year.value = y
  selectedDate.value = ''
  load()
}

const dayEntries = computed(() => byDate.value[selectedDate.value] || [])

// 本地时区的今天（日历高亮）
const todayStr = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">日记日历</h2>
        <p class="text-xs text-white/45">按日期回顾我们的日记</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-ghost" @click="shift(-1)">←</button>
        <span class="serif w-32 text-center">{{ year }} 年 {{ month }} 月</span>
        <button class="btn-ghost" @click="shift(1)">→</button>
        <button class="btn-primary" @click="router.push('/write/solo')">写日记</button>
      </div>
    </div>

    <div class="glass p-4">
      <div class="grid grid-cols-7 gap-1 text-center text-xs text-white/45">
        <span v-for="d in ['日', '一', '二', '三', '四', '五', '六']" :key="d" class="py-1">{{ d }}</span>
      </div>
      <div class="grid grid-cols-7 gap-1">
        <div v-for="(c, i) in cells" :key="i" class="flex aspect-square items-center justify-center">
          <button v-if="c" class="relative flex h-full w-full flex-col items-center justify-center rounded-xl transition-colors"
            :class="[c === todayStr ? 'ring-1 ring-amber-300/60' : '',
              byDate[c]
                ? (c === selectedDate ? 'bg-violet-400/30 ring-1 ring-violet-300' : 'bg-white/5 hover:bg-white/10')
                : 'text-white/35 hover:bg-white/5']"
            @click="byDate[c] && (selectedDate = c)">
            <span :class="c === todayStr ? 'text-amber-200' : ''">{{ Number(c.slice(8)) }}</span>
            <span v-if="byDate[c]" class="mt-0.5 h-1.5 w-1.5 rounded-full bg-violet-300" />
          </button>
        </div>
      </div>
    </div>

    <!-- 当天日记 -->
    <div v-if="selectedDate" class="glass p-5">
      <h3 class="text-sm text-white/70">{{ selectedDate }} · {{ dayEntries.length }} 篇</h3>
      <div class="mt-3 space-y-3">
        <div v-for="e in dayEntries" :key="e.id" class="cursor-pointer rounded-xl bg-white/5 p-4 hover:bg-white/10"
          @click="router.push(`/entry/${e.id}`)">
          <div class="flex items-center gap-2 text-xs">
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-white/60">日记</span>
            <span class="text-white/50">{{ e.title || '无题日记' }}</span>
            <span class="text-white/35">by {{ e.contents.find((c) => c.user_id === session.userId)?.content ? session.me?.nickname : session.partner?.nickname }}</span>
          </div>
          <p class="mt-2 text-sm text-white/70 line-clamp-2">{{ e.contents[0]?.content }}</p>
        </div>
      </div>
    </div>
    <div v-else class="glass p-6 text-center text-sm text-white/40">点一个有圆点的日期查看当天的日记</div>
  </div>
</template>
