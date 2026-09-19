<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listDiary, setVisibility } from '../diary.api.js'
import EntryCard from '../components/EntryCard.vue'
import { useInfiniteScroll } from '../../../composables/useInfiniteScroll'
import { socket } from '../../../socket'
import { session } from '../../../stores/session'

// 日记列表：分页 + 触底自动加载
const router = useRouter()
const PAGE = 20
const entries = ref([])
const total = ref(0)
const loading = ref(true)
const loadingMore = ref(false)

async function load(reset = true) {
  if (reset) {
    loading.value = true
  } else {
    if (loadingMore.value || entries.value.length >= total.value) return
    loadingMore.value = true
  }
  try {
    const offset = reset ? 0 : entries.value.length
    const data = await listDiary(offset, PAGE)
    entries.value = reset ? data.items : [...entries.value, ...data.items]
    total.value = data.total
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const { sentinel } = useInfiniteScroll(
  () => load(false),
  () => entries.value.length < total.value,
)

// 评论实时更新：自己发的只加总数，对方发的未读 +1
function onCommentCreated(comment) {
  if (comment?.target_type !== 'entry') return
  const entry = entries.value.find((item) => item.id === comment.target_id)
  if (!entry) return
  entry.comment_count = (entry.comment_count || 0) + 1
  if (comment.user_id !== session.userId) entry.unread_comment_count = (entry.unread_comment_count || 0) + 1
}

// 月份分组（分页加载时同月自动合并）：手机端可吸顶定位
const monthGroups = computed(() => {
  const groups = []
  const map = new Map()
  const currentYear = new Date().getFullYear()
  for (const entry of entries.value) {
    const d = new Date(entry.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) {
      const label = d.getFullYear() === currentYear ? `${d.getMonth() + 1}月` : `${d.getFullYear()}年${d.getMonth() + 1}月`
      const group = { key, label, items: [] }
      map.set(key, group)
      groups.push(group)
    }
    map.get(key).items.push(entry)
  }
  return groups
})

function onCommentDeleted(payload) {
  if (payload?.targetType !== 'entry') return
  const entry = entries.value.find((item) => item.id === payload.targetId)
  if (entry) entry.comment_count = Math.max(0, (entry.comment_count || 0) - 1)
}

onMounted(() => {
  load()
  socket.on('comment:created', onCommentCreated)
  socket.on('comment:deleted', onCommentDeleted)
})

onUnmounted(() => {
  socket.off('comment:created', onCommentCreated)
  socket.off('comment:deleted', onCommentDeleted)
})

async function togglePublic(entry) {
  await setVisibility(entry.id, !entry.is_public)
  entry.is_public = entry.is_public ? 0 : 1
}
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="serif text-xl">日记 <span class="ml-1 align-middle text-xs font-normal text-white/45">共 {{ total }} 篇</span></h2>
      </div>
      <div class="flex w-full flex-wrap gap-2 sm:w-auto">
        <button class="btn-ghost flex-1 whitespace-nowrap sm:flex-none" @click="router.push('/diary')">🗓️ 日历视图</button>
        <button class="btn-primary flex-1 whitespace-nowrap sm:flex-none" @click="router.push('/write/solo')">✎ 写日记</button>
      </div>
    </div>

    <div v-if="loading" class="py-10 text-center text-white/40">加载中…</div>
    <div v-else-if="!entries.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">📔</div>
      <p class="mt-2">还没有日记，写下第一篇吧</p>
      <button class="btn-primary mt-4" @click="router.push('/write/solo')">写第一篇日记</button>
    </div>
    <div v-else class="space-y-3">
      <section v-for="g in monthGroups" :key="g.key" class="space-y-2.5 sm:space-y-4">
        <div class="sticky top-2 z-10 flex">
          <span class="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs shadow-lg backdrop-blur-xl">
            <span class="serif font-semibold text-white/90">{{ g.label }}</span>
            <span class="text-white/35">{{ g.items.length }} 篇</span>
          </span>
        </div>
        <EntryCard v-for="e in g.items" :key="e.id" :entry="e" @open="(id) => router.push(`/entry/${id}`)"
          @toggle-public="togglePublic" />
      </section>
    </div>

    <div v-if="!loading && entries.length < total" ref="sentinel" class="py-6 text-center text-xs text-white/40">
      {{ loadingMore ? '加载中…' : '上滑加载更多' }}
    </div>
    <div v-else-if="!loading && entries.length" class="py-6 text-center text-xs text-white/25">已经到底了</div>
  </div>
</template>
