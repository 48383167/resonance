<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
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
        <h2 class="serif text-xl">日记</h2>
        <p class="text-xs text-white/45">共 {{ total }} 篇</p>
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
    <div v-else class="grid gap-4">
      <EntryCard v-for="e in entries" :key="e.id" :entry="e" @open="(id) => router.push(`/entry/${id}`)"
        @toggle-public="togglePublic" />
    </div>

    <div v-if="!loading && entries.length < total" ref="sentinel" class="py-6 text-center text-xs text-white/40">
      {{ loadingMore ? '加载中…' : '上滑加载更多' }}
    </div>
    <div v-else-if="!loading && entries.length" class="py-6 text-center text-xs text-white/25">已经到底了</div>
  </div>
</template>
