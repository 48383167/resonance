<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { calendarDiary } from '../diary.api.js'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import CommentCountBadge from '../../../shared/components/CommentCountBadge.vue'

// 日记日历：按月份展示有日记的日期，点日期看当天日记，左右滑动切月
const router = useRouter()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const entries = ref([])
const selectedDate = ref('')
const loading = ref(false)
const listRef = ref(null)
let loadSeq = 0

const byDate = computed(() => {
  const map = {}
  for (const e of entries.value) {
    const d = String(e.created_at || '').slice(0, 10)
    if (!d) continue
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

// 请求序号守卫：快速连续切月时丢弃过期响应
async function load() {
  const seq = ++loadSeq
  loading.value = true
  try {
    const data = await calendarDiary(year.value, month.value)
    if (seq === loadSeq) entries.value = data
  } catch (error) {
    if (seq === loadSeq) toast(error.message || '日历加载失败')
  } finally {
    if (seq === loadSeq) loading.value = false
  }
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

let touchStartX = 0
let touchStartY = 0
function onTouchStart(event) {
  const touch = event.changedTouches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}
function onTouchEnd(event) {
  const touch = event.changedTouches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return
  shift(dx < 0 ? 1 : -1)
}

async function selectDate(day) {
  if (!byDate.value[day]) {
    toast('这天还没有日记')
    return
  }
  selectedDate.value = day
  await nextTick()
  listRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

const dayEntries = computed(() => byDate.value[selectedDate.value] || [])

function authorName(entry) {
  const contents = entry.contents || []
  const mine = contents.find((c) => c.user_id === session.userId)
  return mine?.content ? session.me?.nickname : session.partner?.nickname
}

// 本地时区的今天（日历高亮）
const todayStr = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="serif text-xl">日记日历</h2>
        <p class="text-xs text-white/45">按日期回顾我们的日记</p>
      </div>
      <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button class="btn-ghost shrink-0 !px-4" aria-label="上个月" @click="shift(-1)">←</button>
        <span class="serif min-w-0 flex-1 text-center sm:w-32 sm:flex-none">{{ year }} 年 {{ month }} 月</span>
        <button class="btn-ghost shrink-0 !px-4" aria-label="下个月" @click="shift(1)">→</button>
        <button class="btn-primary w-full sm:w-auto" @click="router.push('/write/solo')">写日记</button>
      </div>
    </div>

    <div class="glass p-4" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <div class="grid grid-cols-7 gap-1 text-center text-xs text-white/45">
        <span v-for="d in ['日', '一', '二', '三', '四', '五', '六']" :key="d" class="py-1">{{ d }}</span>
      </div>
      <div class="grid grid-cols-7 gap-1">
        <div v-for="(c, i) in cells" :key="i" class="flex min-h-11 items-center justify-center">
          <button v-if="c" type="button" class="relative flex min-h-11 w-full flex-col items-center justify-center rounded-xl transition-colors"
            :class="[c === todayStr ? 'ring-1 ring-amber-300/60' : '',
              byDate[c]
                ? (c === selectedDate ? 'bg-accent-soft ring-1 ring-accent' : 'bg-white/5 hover:bg-white/10')
                : 'text-white/35']"
            :aria-pressed="c === selectedDate"
            :aria-label="`${c.slice(8)} 日${byDate[c] ? `，${byDate[c].length} 篇日记` : '，没有日记'}`"
            @click="selectDate(c)">
            <span :class="c === todayStr ? 'text-amber-200' : ''">{{ Number(c.slice(8)) }}</span>
                <span v-if="byDate[c]" class="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
          </button>
        </div>
      </div>
      <p v-if="loading" class="pt-2 text-center text-xs text-white/40">加载中…</p>
      <p v-else class="pt-2 text-center text-[11px] text-white/30">左右滑动切换月份 · 点有圆点的日期查看</p>
    </div>

    <!-- 当天日记 -->
    <div v-if="selectedDate" ref="listRef" class="glass scroll-mt-4 p-5">
      <h3 class="text-sm text-white/70">{{ selectedDate }} · {{ dayEntries.length }} 篇</h3>
      <div class="mt-3 space-y-3">
        <button v-for="e in dayEntries" :key="e.id" type="button"
          class="block w-full cursor-pointer rounded-xl bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
          @click="router.push(`/entry/${e.id}`)">
          <div class="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-white/60">日记</span>
            <span class="break-words text-white/50">{{ e.title || '无题日记' }}</span>
            <span class="text-white/35">by {{ authorName(e) }}</span>
            <CommentCountBadge :count="e.comment_count" :unread="e.unread_comment_count" />
          </div>
           <p class="mt-2 break-words text-sm text-white/70 line-clamp-2">{{ e.contents?.[0]?.content }}</p>
        </button>
      </div>
    </div>
    <div v-else class="glass p-6 text-center text-sm text-white/40">点一个有圆点的日期查看当天的日记</div>
  </div>
</template>
