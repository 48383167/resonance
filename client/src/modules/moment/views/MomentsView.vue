<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listMoments, removeMoment, updateMomentShareVisibility } from '../moment.api.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import { openLightbox } from '../../../stores/lightbox'
import { socket } from '../../../socket'
import { session } from '../../../stores/session'
import { mediaTypeOf } from '../../../utils/media'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'
import AppSelect from '../../../shared/components/AppSelect.vue'
import CommentCountBadge from '../../../shared/components/CommentCountBadge.vue'
import CommentSection from '../../comment/components/CommentSection.vue'

const router = useRouter()
const list = ref([])
const loading = ref(true)
const searching = ref(false)
const PAGE = 15
const visible = ref(PAGE)
const sharing = ref(new Set())
const commentsOpen = ref(new Set())

function toggleComments(id) {
  const next = new Set(commentsOpen.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  commentsOpen.value = next
}

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
    list.value = await listMoments(params)
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

// 评论实时更新：自己发的只加总数，对方发的未读 +1（评论区展开时不加未读，加载后会标记已读）
function onCommentCreated(comment) {
  if (comment?.target_type !== 'moment') return
  const moment = list.value.find((item) => item.id === comment.target_id)
  if (!moment) return
  moment.comment_count = (moment.comment_count || 0) + 1
  if (comment.user_id !== session.userId && !commentsOpen.value.has(moment.id)) {
    moment.unread_comment_count = (moment.unread_comment_count || 0) + 1
  }
}

function onCommentDeleted(payload) {
  if (payload?.targetType !== 'moment') return
  const moment = list.value.find((item) => item.id === payload.targetId)
  if (moment) moment.comment_count = Math.max(0, (moment.comment_count || 0) - 1)
}

function onCommentsRead({ targetId }) {
  const moment = list.value.find((item) => item.id === targetId)
  if (moment) moment.unread_comment_count = 0
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

const shown = computed(() => list.value.slice(0, visible.value))
function loadMore() {
  visible.value += PAGE
}

async function remove(m) {
  const ok = await confirmDialog({ title: '删除瞬间', message: '确定删除这条瞬间吗？删除后无法恢复。' })
  if (!ok) return
  await removeMoment(m.id)
  await load()
  toast('已删除')
}

const isShownInShare = (m) => m.show_in_share !== 0

async function toggleShareVisibility(m) {
  if (sharing.value.has(m.id)) return
  const showInShare = !isShownInShare(m)
  sharing.value = new Set(sharing.value).add(m.id)
  try {
    const updated = await updateMomentShareVisibility(m.id, showInShare)
    Object.assign(m, updated)
    toast(showInShare ? '已在分享页展示' : '已从分享页隐藏')
  } catch (error) {
    toast(error.message || '更新分享展示状态失败', 'error')
  } finally {
    const next = new Set(sharing.value)
    next.delete(m.id)
    sharing.value = next
  }
}

const dateText = (m) => (m.moment_date || m.created_at.slice(0, 10))

function openMomentPhoto(photos, photo) {
  const images = photos.filter((item) => (item.type || mediaTypeOf(item.url || '')) === 'image')
  const index = images.indexOf(photo)
  if (index >= 0) openLightbox(images.map((item) => item.url), index)
}
</script>

<template>
  <div class="fade-up space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="serif text-xl">恋爱瞬间</h2>
        <p class="text-xs text-white/45">记录此刻的心情、地点与照片</p>
      </div>
      <div class="flex w-full flex-wrap gap-2 sm:w-auto">
        <button class="btn-ghost flex-1 whitespace-nowrap sm:flex-none" @click="router.push('/map')">🗺️ 足迹地图</button>
        <button class="btn-primary flex-1 whitespace-nowrap sm:flex-none" @click="router.push('/moments/new')">+ 记录瞬间</button>
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
          <div class="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <span class="text-lg">{{ moodOf(m.mood).emoji }}</span>
            <span class="text-accent">{{ m.author?.nickname || 'Ta' }}</span>
            <span class="text-xs text-white/40">· {{ dateText(m) }}</span>
            <span v-if="m.location" class="break-words text-xs text-accent-2">📍 {{ m.location }}</span>
          </div>
          <div class="flex min-w-0 flex-wrap justify-end gap-2 text-xs">
            <button type="button"
              class="min-h-8 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              :class="isShownInShare(m)
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-theme surface-soft text-theme-secondary hover-text-accent'"
              :disabled="sharing.has(m.id)" :aria-pressed="isShownInShare(m)"
              :aria-label="isShownInShare(m) ? '分享页展示中，点击关闭' : '分享页不展示，点击开启'"
              @click="toggleShareVisibility(m)">
              {{ sharing.has(m.id) ? '更新中…' : (isShownInShare(m) ? '✓ 分享页展示' : '分享页不展示') }}
            </button>
            <button class="text-white/50 transition-colors hover:text-white" @click="router.push(`/moments/${m.id}/edit`)">编辑</button>
            <button class="text-rose-300/80 transition-colors hover:text-rose-300" @click="remove(m)">删除</button>
          </div>
        </div>
        <p class="mt-3 break-words whitespace-pre-wrap leading-relaxed">{{ m.content }}</p>
        <div v-if="m.places?.length" class="mt-3 flex flex-wrap gap-2">
          <button v-for="place in m.places" :key="place.id" type="button"
            class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-theme surface-soft px-3 py-1.5 text-[11px] text-theme-secondary transition-colors hover-text-accent"
            @click="router.push(`/foods/${place.id}`)">
            🍜 {{ place.name }}<span v-if="place.rating" class="text-accent">{{ place.rating }}★</span>
          </button>
        </div>
        <div v-if="m.photos?.length" class="mt-3 flex flex-wrap gap-2">
          <img v-for="(u, pi) in m.photos" :key="u.id || u.url || pi" :src="u.url" class="h-24 w-24 cursor-zoom-in rounded-lg object-cover"
            loading="lazy" @click="openMomentPhoto(m.photos, u)" />
        </div>
        <div class="mt-3">
          <button type="button"
            class="inline-flex min-h-8 items-center gap-2 rounded-full border border-theme surface-soft px-3 py-1.5 text-[11px] font-medium text-theme-secondary transition-colors hover-text-accent"
            @click="toggleComments(m.id)">
            <span>💬 {{ commentsOpen.has(m.id) ? '收起评论' : '评论' }}</span>
            <CommentCountBadge :count="m.comment_count" :unread="m.unread_comment_count" />
          </button>
        </div>
        <CommentSection v-if="commentsOpen.has(m.id)" target-type="moment" :target-id="m.id" @read="onCommentsRead" />
      </article>
      <div v-if="list.length > visible" class="flex justify-center">
        <button class="btn-ghost" @click="loadMore">加载更多（还有 {{ list.length - visible }} 条）</button>
      </div>
    </div>
  </div>
</template>
