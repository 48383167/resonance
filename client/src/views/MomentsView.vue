<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { toast } from '../stores/toast'
import { confirmDialog } from '../stores/confirm'
import { openLightbox } from '../stores/lightbox'
import AppDatePicker from '../components/AppDatePicker.vue'
import AppSelect from '../components/AppSelect.vue'

const router = useRouter()
const list = ref([])
const loading = ref(true)
const searching = ref(false)
const PAGE = 15
const visible = ref(PAGE)

const MOODS = [
  { key: 'normal', emoji: '😌', label: '平静' },
  { key: 'happy', emoji: '😄', label: '开心' },
  { key: 'sweet', emoji: '🥰', label: '甜蜜' },
  { key: 'missed', emoji: '🥺', label: '想念' },
  { key: 'angry', emoji: '😠', label: '生气' },
  { key: 'sad', emoji: '😢', label: '难过' },
]
const moodOf = (k) => MOODS.find((m) => m.key === k) || MOODS[0]

// 心情筛选选项（含「全部心情」）
const moodOptions = [
  { value: '', label: '全部心情', icon: '🎨' },
  ...MOODS.map((m) => ({ value: m.key, label: m.label, icon: m.emoji })),
]

// 筛选条件（点「查询」生效）
const fMood = ref('')
const fKeyword = ref('')
const fStart = ref('')
const fEnd = ref('')

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (fMood.value) params.set('mood', fMood.value)
    if (fKeyword.value) params.set('keyword', fKeyword.value)
    if (fStart.value) params.set('startDate', fStart.value)
    if (fEnd.value) params.set('endDate', fEnd.value)
    list.value = await api.get(`/api/moments?${params}`)
    visible.value = PAGE
  } finally {
    loading.value = false
  }
}

async function search() {
  if (fStart.value && fEnd.value && fStart.value > fEnd.value) return toast('开始日期不能晚于结束日期')
  searching.value = true
  await load()
  searching.value = false
}

function reset() {
  fMood.value = ''
  fKeyword.value = ''
  fStart.value = ''
  fEnd.value = ''
  load()
}

onMounted(load)

const shown = computed(() => list.value.slice(0, visible.value))
function loadMore() {
  visible.value += PAGE
}

async function remove(m) {
  const ok = await confirmDialog({ title: '删除瞬间', message: '确定删除这条瞬间吗？删除后无法恢复。' })
  if (!ok) return
  await api.delete(`/api/moments/${m.id}`)
  await load()
  toast('已删除')
}

const dateText = (m) => (m.moment_date || m.created_at.slice(0, 10))
</script>

<template>
  <div class="fade-up space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">恋爱瞬间</h2>
        <p class="text-xs text-white/45">记录此刻的心情、地点与照片</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost" @click="router.push('/map')">🗺️ 足迹地图</button>
        <button class="btn-primary" @click="router.push('/moments/new')">+ 记录瞬间</button>
      </div>
    </div>

    <!-- 筛选：z-20 让下拉面板浮在下方内容之上，不被遮挡 -->
    <div class="glass relative z-20 p-4">
      <div class="space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <AppSelect v-model="fMood" :options="moodOptions" />
          <input v-model="fKeyword" class="input-dark" placeholder="搜索内容 / 地点关键词…" @keyup.enter="search" />
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <AppDatePicker v-model="fStart" placeholder="开始日期" />
          <span class="hidden text-center text-white/40 sm:block">至</span>
          <AppDatePicker v-model="fEnd" placeholder="结束日期" />
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-ghost px-5 py-2 text-sm" @click="reset">重置</button>
          <button class="btn-primary px-6 py-2 text-sm" :disabled="searching" @click="search">
            {{ searching ? '查询中…' : '🔍 查询' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="py-10 text-center text-white/40">加载中…</div>
    <div v-else-if="!list.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">✨</div>
      <p class="mt-2">还没有符合条件的瞬间，记录第一个吧</p>
    </div>
    <div v-else class="space-y-3">
      <article v-for="m in shown" :key="m.id" class="glass p-5 transition-colors hover:bg-white/8">
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="text-lg">{{ moodOf(m.mood).emoji }}</span>
            <span class="text-violet-200">{{ m.author?.nickname || 'Ta' }}</span>
            <span class="text-xs text-white/40">· {{ dateText(m) }}</span>
            <span v-if="m.location" class="text-xs text-sky-200/80">📍 {{ m.location }}</span>
          </div>
          <div class="flex gap-3 text-xs">
            <button class="text-white/50 transition-colors hover:text-white" @click="router.push(`/moments/${m.id}/edit`)">编辑</button>
            <button class="text-rose-300/80 transition-colors hover:text-rose-300" @click="remove(m)">删除</button>
          </div>
        </div>
        <p class="mt-3 whitespace-pre-wrap leading-relaxed">{{ m.content }}</p>
        <div v-if="m.photos?.length" class="mt-3 flex flex-wrap gap-2">
          <img v-for="(u, pi) in m.photos" :key="u" :src="u" class="h-24 w-24 cursor-zoom-in rounded-lg object-cover"
            loading="lazy" @click="openLightbox(m.photos, pi)" />
        </div>
      </article>
      <div v-if="list.length > visible" class="flex justify-center">
        <button class="btn-ghost" @click="loadMore">加载更多（还有 {{ list.length - visible }} 条）</button>
      </div>
    </div>
  </div>
</template>
