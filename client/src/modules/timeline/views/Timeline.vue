<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getTimeline } from '../timeline.api.js'
import { openLightbox } from '../../../stores/lightbox'
import { currentTheme } from '../../../stores/theme'

const router = useRouter()
const data = ref(null)
const loading = ref(true)
const expanded = ref(new Set())
const fKind = ref('')

const KINDS = [
  { key: '', label: '全部' },
  { key: 'entry', label: '📔 日记' },
  { key: 'moment', label: '✨ 瞬间' },
  { key: 'letter', label: '💌 情书' },
  { key: 'wish', label: '🧭 心愿' },
  { key: 'capsule', label: '⏳ 胶囊' },
  { key: 'anniversary', label: '📅 纪念日' },
  { key: 'photo', label: '📷 照片' },
]

const META = {
  entry: { color: 'accent' },
  moment: { color: '#ffd9a0' },
  letter: { color: '#ffb3d1' },
  wish: { color: '#ffcd78' },
  capsule: { color: '#a0b4ff' },
  anniversary: { color: '#ff96a0' },
  photo: { color: '#8cdcbe' },
}

const MOODS = { normal: '😌', happy: '😄', sweet: '🥰', missed: '🥺', angry: '😠', sad: '😢' }
const moodEmoji = (m) => MOODS[m] || '😌'
const metaColor = (kind) => META[kind].color === 'accent' ? currentTheme.primaryColor : META[kind].color

const filtered = computed(() => {
  const list = data.value?.events || []
  return fKind.value ? list.filter((e) => e.kind === fKind.value) : list
})

// 各类型数量（筛选计数）
const kindCounts = computed(() => {
  const map = { entry: 0, moment: 0, letter: 0, wish: 0, capsule: 0, anniversary: 0, photo: 0 }
  for (const e of data.value?.events || []) map[e.kind] = (map[e.kind] || 0) + 1
  return map
})

const groups = computed(() => {
  const map = new Map()
  for (const e of filtered.value) {
    const date = e.ts.slice(0, 10)
    if (!map.has(date)) map.set(date, [])
    map.get(date).push(e)
  }
  return [...map.entries()].map(([date, items]) => ({
    date,
    label: dateLabel(date),
    day: dayCount(date),
    items,
  }))
})

function dateLabel(iso) {
  const d = new Date(iso)
  const md = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  const wd = d.toLocaleDateString('zh-CN', { weekday: 'long' })
  return `${md} · ${wd}`
}

function dayCount(date) {
  if (!data.value?.pairStart) return null
  const n = Math.floor((new Date(date) - new Date(data.value.pairStart)) / 86400000) + 1
  return n >= 1 ? n : null
}

const timeOf = (ts) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

function keyOf(gIdx, i) { return `${gIdx}-${i}` }
function toggle(gIdx, i) {
  const key = keyOf(gIdx, i)
  if (expanded.value.has(key)) expanded.value.delete(key)
  else expanded.value.add(key)
  expanded.value = new Set(expanded.value)
}
const isOpen = (gIdx, i) => expanded.value.has(keyOf(gIdx, i))

async function load() {
  loading.value = true
  try {
    data.value = await getTimeline()
  } finally {
    loading.value = false
  }
}
onMounted(load)
const anniversaryTypeLabel = (t) => ({ first_meet: '初遇', together: '在一起', birthday: '生日', custom: '纪念日' }[t] || '纪念日')
</script>

<template>
  <div class="fade-up">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">时光时间线</h2>
        <p class="text-xs text-white/45">我们的点点滴滴，沿时间缓缓流淌</p>
      </div>
    </div>

    <!-- 类型筛选 -->
    <div class="mt-4 flex flex-wrap gap-2">
      <button v-for="k in KINDS" :key="k.key" @click="fKind = k.key"
        class="rounded-full px-3 py-1 text-xs transition-all"
         :class="fKind === k.key ? 'bg-accent-soft ring-1 ring-accent' : 'bg-white/5 text-white/60 hover:bg-white/10'">
        {{ k.label }}
        <span v-if="k.key" class="ml-1 opacity-60">{{ kindCounts[k.key] }}</span>
        <span v-else class="ml-1 opacity-60">{{ (data?.events || []).length }}</span>
      </button>
    </div>

    <div v-if="loading" class="py-12 text-center text-white/40">正在展开时间…</div>
    <div v-else-if="!filtered.length" class="glass mt-6 p-10 text-center text-white/50">
      <div class="text-3xl">🕰️</div>
      <p class="mt-2">时间线还空着，写下第一笔吧</p>
      <button class="btn-primary mt-4" @click="router.push('/write/solo')">写第一篇日记</button>
    </div>

    <!-- 时间线 -->
    <div v-else class="relative mt-6 pb-8">
      <!-- 发光主线 -->
      <div class="absolute bottom-0 left-[13px] top-0 w-0.5 md:left-1/2 md:-translate-x-1/2"
        style="background: linear-gradient(180deg, transparent, var(--accent) 12%, var(--accent-2) 88%, transparent); box-shadow: 0 0 12px rgb(var(--accent-rgb) / 0.5)" />

      <div v-for="(g, gIdx) in groups" :key="g.date" class="relative">
        <!-- 日期分组 -->
        <div class="sticky top-2 z-10 mb-5 flex justify-center">
          <div class="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 shadow-lg backdrop-blur-xl">
            <span class="serif text-xs font-semibold tracking-wide text-white/90">{{ g.label }}</span>
            <span v-if="g.day" class="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-medium text-amber-200/90 ring-1 ring-amber-300/20">相识第 {{ g.day }} 天</span>
          </div>
        </div>

        <div v-for="(e, i) in g.items" :key="keyOf(gIdx, i)"
          class="fade-up relative mb-5 min-w-0 md:grid md:grid-cols-[1fr_2rem_1fr] md:gap-3"
          :style="{ animationDelay: `${Math.min(i, 10) * 60}ms` }">
          <!-- 节点：仅保留类型图标（清爽悬浮于主线上） -->
          <div class="absolute left-[13px] top-4 z-10 -translate-x-1/2 md:left-1/2">
            <span class="flex h-8 w-8 items-center justify-center rounded-full text-sm shadow-lg ring-2 ring-ambient"
              :style="{ background: `linear-gradient(135deg, ${metaColor(e.kind)}55, ${metaColor(e.kind)}22)`, boxShadow: `0 0 14px ${metaColor(e.kind)}88` }">
              {{ {
                entry: '📔', moment: moodEmoji(e.mood), letter: '💌', wish: '🧭', capsule: e.unlocked ? '⏳' : '🔒',
                anniversary: '📅', photo: '📷',
              }[e.kind] }}
            </span>
          </div>

          <!-- 卡片（桌面交替左右，移动端靠右） -->
          <div class="ml-9 md:col-start-1 md:ml-0" :class="i % 2 ? 'md:col-start-3 md:pl-3' : 'md:pr-3'">
            <article class="glass cursor-pointer p-4 transition-colors hover:bg-white/10" @click="toggle(gIdx, i)">
              <!-- 头部：标题 + 时间（时间收纳进卡片，不再压在线上） -->
              <div class="flex items-start justify-between gap-2">
                <span class="min-w-0 break-words text-xs leading-5 text-white/70">
                  <template v-if="e.kind === 'entry'">📔 日记 · {{ e.title }}</template>
                  <template v-else-if="e.kind === 'moment'">{{ e.author }} 的瞬间</template>
                  <template v-else-if="e.kind === 'letter'">{{ e.title }} <span v-if="e.isSecret">🔐</span></template>
                  <template v-else-if="e.kind === 'wish'">完成了心愿：{{ e.title }}</template>
                  <template v-else-if="e.kind === 'capsule'">{{ e.title }}</template>
                  <template v-else-if="e.kind === 'anniversary'">{{ anniversaryTypeLabel(e.anniversaryType) }} · {{ e.title }}</template>
                  <template v-else>📷 {{ e.album }}</template>
                </span>
                <span class="shrink-0 text-[10px] leading-5 text-white/40">{{ timeOf(e.ts) }}</span>
              </div>

              <!-- 内容 -->
              <p v-if="e.kind !== 'photo'" class="mt-2 break-words text-sm text-white/75"
                :class="[isOpen(gIdx, i) ? 'whitespace-pre-wrap' : 'line-clamp-2', e.kind === 'capsule' && !e.unlocked ? 'blur-[3px] select-none' : '']">
                {{ e.text }}
              </p>
              <p v-else class="mt-2 break-words text-sm text-white/75">{{ e.text || e.album }}</p>

              <!-- 照片 -->
              <div v-if="(e.kind === 'photo' || e.photos?.length)" class="mt-2 flex flex-wrap gap-2">
                <img v-if="e.kind === 'photo'" :src="e.url" class="h-28 cursor-zoom-in rounded-lg object-cover"
                  loading="lazy" @click.stop="openLightbox([e.url], 0)" />
                <img v-for="(u, pi) in e.photos" :key="u" :src="u" class="h-20 w-20 cursor-zoom-in rounded-lg object-cover"
                  loading="lazy" @click.stop="openLightbox(e.photos, pi)" />
              </div>

              <!-- 尾巴信息 -->
              <div class="mt-2 flex items-center gap-2 text-[11px] text-white/35">
                 <span v-if="e.kind === 'moment' && e.location" class="break-words">📍 {{ e.location }}</span>
                 <span v-if="e.kind === 'letter'" class="break-words">来自 {{ e.sender }}</span>
                <span v-if="e.kind === 'wish' && e.proposer">by {{ e.proposer }}</span>
                <span v-if="e.kind === 'capsule'">解锁于 {{ e.unlockDate }}</span>
                <router-link v-if="e.kind === 'entry'" :to="`/entry/${e.entryId}`"
                  class="ml-auto text-accent hover:underline" @click.stop>查看详情 →</router-link>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
