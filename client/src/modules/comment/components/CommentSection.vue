<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { socket } from '../../../socket'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import { generateIdempotencyKey } from '../../../utils/idempotency'
import { applyCommentUnread } from '../../../stores/commentUnread'
import { listComments, createComment, markCommentsRead, removeComment } from '../comment.api.js'
import { loadCommentDraft, saveCommentDraft, clearCommentDraft } from '../commentDraft.js'
import CommentComposerSheet from './CommentComposerSheet.vue'

const props = defineProps({
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
})

const emit = defineEmits(['read'])

const comments = ref([])
const loading = ref(true)
const submitting = ref(false)
const draft = ref('')
const replyTarget = ref(null)
const composerRef = ref(null)
const collapsed = ref(false)
const expanded = ref(false)

// 触摸设备（手机）回车换行、点发送；桌面 Enter 发送、Shift + Enter 换行
const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false
const MAX_INLINE_HEIGHT = 144
const inlineOverflow = ref(false)
let pendingReplyParentId = ''

const roots = computed(() => comments.value.filter((c) => !c.parent_id))
const repliesOf = (parentId) => comments.value.filter((c) => c.parent_id === parentId)

const ROOT_PREVIEW = 3
// 一级评论视图：preview=默认 3 条 / all=全部展开 / none=全部收起
const rootsView = ref('preview')

const visibleRoots = computed(() => {
  if (rootsView.value === 'all') return roots.value
  if (rootsView.value === 'none') return []
  return roots.value.slice(0, ROOT_PREVIEW)
})

function rootsToggleText() {
  if (rootsView.value === 'all') return '收起'
  if (rootsView.value === 'none') {
    return roots.value.length ? `展开全部 ${roots.value.length} 条评论` : ''
  }
  const hidden = roots.value.length - ROOT_PREVIEW
  if (hidden > 0) return `展开其余 ${hidden} 条评论`
  return roots.value.length ? '收起' : ''
}

function toggleRoots() {
  if (rootsView.value === 'none') rootsView.value = 'all'
  else if (rootsView.value === 'all') rootsView.value = 'none'
  else rootsView.value = roots.value.length > ROOT_PREVIEW ? 'all' : 'none'
}

const REPLY_PREVIEW = 2
const expandedRoots = ref(new Set())
const collapsedRoots = ref(new Set())

function visibleReplies(rootId) {
  if (collapsedRoots.value.has(rootId)) return []
  const list = repliesOf(rootId)
  if (expandedRoots.value.has(rootId) || list.length <= REPLY_PREVIEW) return list
  return list.slice(0, REPLY_PREVIEW)
}

// 一级评论上的按钮：收起该评论全部子评论 / 重新展开
function repliesInlineText(rootId) {
  const total = repliesOf(rootId).length
  if (!total) return ''
  return collapsedRoots.value.has(rootId) ? `展开 ${total} 条回复` : '收起回复'
}

function toggleRepliesInline(rootId) {
  const next = new Set(collapsedRoots.value)
  if (next.has(rootId)) next.delete(rootId)
  else next.add(rootId)
  collapsedRoots.value = next
}

// 预览态底部的「展开其余 N 条回复」：展开到全部（收起由一级评论上的按钮负责）
function repliesMoreText(rootId) {
  if (collapsedRoots.value.has(rootId) || expandedRoots.value.has(rootId)) return ''
  const hidden = repliesOf(rootId).length - REPLY_PREVIEW
  return hidden > 0 ? `展开其余 ${hidden} 条回复` : ''
}

function expandReplies(rootId) {
  expandedRoots.value = new Set(expandedRoots.value).add(rootId)
}

function revealReplies(rootId) {
  const next = new Set(collapsedRoots.value)
  next.delete(rootId)
  collapsedRoots.value = next
  expandedRoots.value = new Set(expandedRoots.value).add(rootId)
}

function nicknameOf(userId) {
  return userId === session.userId
    ? (session.me?.nickname || '我')
    : (session.partner?.nickname || 'Ta')
}

// 直接回复目标：优先精确到某条评论；旧数据回退到「回复 @某人」
function quoteTarget(comment) {
  if (!comment.reply_to_comment_id) return null
  return comments.value.find((c) => c.id === comment.reply_to_comment_id) || null
}

function quoteText(comment) {
  const target = quoteTarget(comment)
  if (!target) return `回复 @${nicknameOf(comment.reply_to_user_id)}`
  const name = target.author?.nickname || 'Ta'
  if (target.deleted_at) return `${name}：该评论已删除`
  const text = target.content.length > 40 ? `${target.content.slice(0, 40)}…` : target.content
  return `${name}：${text}`
}

function commentDomId(id) {
  return `comment-${props.targetId}-${id}`
}

// 点击引用摘要：滚动到被回复的评论并短暂高亮（目标被折叠时先展开）
const highlightId = ref('')
let highlightTimer = null
function jumpTo(comment) {
  const id = comment.reply_to_comment_id
  if (!id) return
  const target = comments.value.find((c) => c.id === id)
  // 目标可能被一级评论折叠或回复折叠隐藏：先展开再定位
  if (rootsView.value !== 'all') rootsView.value = 'all'
  if (target?.parent_id) revealReplies(target.parent_id)
  nextTick(() => {
    const el = document.getElementById(commentDomId(id))
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightId.value = id
    clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => { highlightId.value = '' }, 1600)
  })
}

function sameTarget(payload) {
  return payload?.target_type === props.targetType && payload?.target_id === props.targetId
}

function byTimeAsc(a, b) {
  return String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id))
}

// 创建者本人也会收到 socket 广播；按 id 去重，避免与 POST 响应重复
function upsert(comment) {
  if (!sameTarget(comment)) return
  if (comments.value.some((c) => c.id === comment.id)) return
  comments.value = [...comments.value, comment].sort(byTimeAsc)
  // 正在看评论区时收到对方新评论，立即视为已读
  if (comment.user_id !== session.userId) markRead()
}

// 墓碑化：清空正文并标记删除时间，其下回复保持可见
function markTombstone(id) {
  comments.value = comments.value.map((c) => (
    c.id === id ? { ...c, content: '', deleted_at: new Date().toISOString() } : c
  ))
}

function drop(payload) {
  if (payload?.targetType !== props.targetType || payload?.targetId !== props.targetId) return
  if (payload.tombstoned) markTombstone(payload.id)
  else comments.value = comments.value.filter((c) => c.id !== payload.id)
}

// 打开评论区即已读：上报后直接用响应里的全局未读总览刷新角标
async function markRead() {
  try {
    const result = await markCommentsRead({ targetType: props.targetType, targetId: props.targetId })
    applyCommentUnread(result?.unread)
    emit('read', { targetType: props.targetType, targetId: props.targetId })
  } catch { /* 已读上报失败不影响评论阅读 */ }
}

async function load() {
  loading.value = true
  try {
    comments.value = await listComments(props.targetType, props.targetId)
    // 恢复草稿时记录的回复对象：目标仍存在且未删除才恢复，否则降级为顶层评论
    if (pendingReplyParentId) {
      const target = comments.value.find((c) => c.id === pendingReplyParentId && !c.deleted_at)
      if (target) replyTarget.value = target
      pendingReplyParentId = ''
    }
    markRead()
  } catch (error) {
    toast(error.message || '评论加载失败', 'error')
  } finally {
    loading.value = false
  }
}

// 内联输入框自动增高（约 1~6 行）；超出后显示「展开编辑」进入全屏
function syncComposer() {
  const el = composerRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_INLINE_HEIGHT)}px`
  inlineOverflow.value = el.scrollHeight > MAX_INLINE_HEIGHT + 1
}

function onComposerEnter(event) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.shiftKey || isTouchDevice) return
  event.preventDefault()
  submit()
}

// 软键盘弹起后把输入条滚入可视区，避免被键盘或底部导航遮挡
function onComposerFocus() {
  window.setTimeout(() => {
    composerRef.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 250)
}

function persistDraft() {
  saveCommentDraft(props.targetType, props.targetId, {
    content: draft.value,
    parentId: replyTarget.value?.id || '',
    replyToUserId: replyTarget.value?.user_id || '',
  })
}

watch(draft, () => {
  persistDraft()
  nextTick(syncComposer)
})
watch(replyTarget, persistDraft)
watch(collapsed, (value) => { if (!value) nextTick(syncComposer) })
watch(expanded, (value) => { if (!value) nextTick(syncComposer) })

async function submit() {
  const content = draft.value.trim()
  if (!content || submitting.value) return
  submitting.value = true
  try {
    const payload = { targetType: props.targetType, targetId: props.targetId, content }
    if (replyTarget.value) payload.parentId = replyTarget.value.id
    const comment = await createComment(payload, generateIdempotencyKey())
    upsert(comment)
    // 自己新发的顶层评论若被折叠，自动展开到可见；自己发的回复确保其所在评论展开
    if (!comment.parent_id) rootsView.value = 'all'
    else revealReplies(comment.parent_id)
    draft.value = ''
    replyTarget.value = null
    expanded.value = false
    clearCommentDraft(props.targetType, props.targetId)
  } catch (error) {
    toast(error.message || '评论发送失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function startReply(comment) {
  replyTarget.value = comment
  await nextTick()
  composerRef.value?.focus()
}

function cancelReply() {
  replyTarget.value = null
}

async function remove(comment) {
  const hasReplies = repliesOf(comment.id).length > 0
  const message = hasReplies
    ? '该评论下有回复，删除后将显示「该评论已删除」，回复会保留。'
    : '确定删除这条评论吗？删除后无法恢复。'
  const ok = await confirmDialog({ title: '删除评论', message })
  if (!ok) return
  try {
    const result = await removeComment(comment.id)
    if (result?.tombstoned) markTombstone(comment.id)
    else comments.value = comments.value.filter((c) => c.id !== comment.id)
    if (replyTarget.value?.id === comment.id) replyTarget.value = null
  } catch (error) {
    toast(error.message || '评论删除失败', 'error')
  }
}

function timeText(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

onMounted(() => {
  const saved = loadCommentDraft(props.targetType, props.targetId)
  if (saved?.content) {
    draft.value = saved.content
    pendingReplyParentId = saved.parentId || ''
    nextTick(syncComposer)
  }
  load()
  socket.on('comment:created', upsert)
  socket.on('comment:deleted', drop)
})

onUnmounted(() => {
  socket.off('comment:created', upsert)
  socket.off('comment:deleted', drop)
  clearTimeout(highlightTimer)
})
</script>

<template>
  <div class="mt-4 border-t border-theme pt-3">
    <button type="button"
      class="flex items-center gap-2 text-xs text-theme-tertiary transition-colors hover-text-accent"
      @click="collapsed = !collapsed">
      <span>💬 评论</span>
      <span v-if="comments.length">{{ comments.length }}</span>
      <span class="text-[10px]">{{ collapsed ? '▸' : '▾' }}</span>
    </button>

    <template v-if="!collapsed">
    <div v-if="loading" class="py-2 text-xs text-theme-tertiary">加载中…</div>
    <div v-else-if="!comments.length" class="py-2 text-xs text-theme-tertiary">还没有评论，说点什么吧</div>
    <div v-else class="mt-2 space-y-3">
      <div v-for="root in visibleRoots" :key="root.id" class="space-y-2">
        <div :id="commentDomId(root.id)" class="surface-soft rounded-xl px-3 py-2"
          :style="highlightId === root.id ? { boxShadow: '0 0 0 2px var(--accent)' } : null">
          <p v-if="root.deleted_at" class="text-sm italic text-theme-tertiary">该评论已删除</p>
          <template v-else>
            <div class="flex items-center gap-2 text-xs">
              <span class="text-accent">{{ root.author?.nickname || 'Ta' }}</span>
              <span class="text-theme-tertiary">{{ timeText(root.created_at) }}</span>
              <button v-if="root.user_id === session.userId"
                class="danger-link ml-auto transition-colors"
                @click="remove(root)">删除</button>
            </div>
            <p class="mt-1 break-words whitespace-pre-wrap text-sm leading-relaxed">{{ root.content }}</p>
          </template>
          <div class="mt-1 flex items-center gap-3 text-xs text-theme-tertiary">
            <button v-if="!root.deleted_at" class="transition-colors hover-text-accent"
              @click="startReply(root)">回复</button>
            <button v-if="repliesInlineText(root.id)" class="transition-colors hover-text-accent"
              @click="toggleRepliesInline(root.id)">
              {{ repliesInlineText(root.id) }}
            </button>
          </div>
        </div>

        <div v-for="r in visibleReplies(root.id)" :key="r.id" class="ml-4 border-l border-theme pl-3">
          <div :id="commentDomId(r.id)" class="surface-soft rounded-xl px-3 py-2"
            :style="highlightId === r.id ? { boxShadow: '0 0 0 2px var(--accent)' } : null">
            <p v-if="r.deleted_at" class="text-sm italic text-theme-tertiary">该评论已删除</p>
            <template v-else>
              <div class="flex items-center gap-2 text-xs">
                <span class="text-accent">{{ r.author?.nickname || 'Ta' }}</span>
                <span class="text-theme-tertiary">{{ timeText(r.created_at) }}</span>
                <button v-if="r.user_id === session.userId"
                  class="danger-link ml-auto transition-colors"
                  @click="remove(r)">删除</button>
              </div>
              <button v-if="r.reply_to_comment_id" type="button"
                class="mt-1 block max-w-full truncate rounded border-l-2 border-theme pl-2 text-left text-xs text-theme-tertiary transition-colors hover-text-accent"
                @click="jumpTo(r)">↩ {{ quoteText(r) }}</button>
              <span v-else-if="r.reply_to_user_id" class="mt-1 block text-xs text-theme-tertiary">
                回复 @{{ nicknameOf(r.reply_to_user_id) }}
              </span>
              <p class="mt-1 break-words whitespace-pre-wrap text-sm leading-relaxed">{{ r.content }}</p>
              <div class="mt-1 text-xs text-theme-tertiary">
                <button class="transition-colors hover-text-accent" @click="startReply(r)">回复</button>
              </div>
            </template>
          </div>
        </div>

        <button v-if="repliesMoreText(root.id)" type="button"
          class="ml-4 text-xs text-theme-tertiary transition-colors hover-text-accent"
          @click="expandReplies(root.id)">
          {{ repliesMoreText(root.id) }}
        </button>
      </div>

      <button v-if="rootsToggleText()" type="button"
        class="text-xs text-theme-tertiary transition-colors hover-text-accent"
        @click="toggleRoots">
        {{ rootsToggleText() }}
      </button>
    </div>

    <div v-if="replyTarget" class="mt-2 flex items-center gap-2 text-xs text-theme-tertiary">
      <span>回复 @{{ nicknameOf(replyTarget.user_id) }}</span>
      <button class="transition-colors hover-text-accent" @click="cancelReply">✕ 取消</button>
    </div>

    <div class="mt-2 flex items-end gap-2">
      <textarea ref="composerRef" v-model="draft" rows="1" maxlength="500"
        class="input-dark comment-textarea min-w-0 flex-1 scroll-mb-24"
        :placeholder="replyTarget ? `回复 @${nicknameOf(replyTarget.user_id)}…` : '写下你的评论…'"
        :enterkeyhint="isTouchDevice ? 'enter' : 'send'"
        @focus="onComposerFocus" @keydown.enter="onComposerEnter" />
      <button class="btn-primary shrink-0 px-4 py-2 text-sm"
        :disabled="!draft.trim() || submitting" @click="submit">
        {{ submitting ? '发送中…' : '发送' }}
      </button>
    </div>
    <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-theme-tertiary">
      <button v-if="inlineOverflow || isTouchDevice" type="button"
        class="transition-colors hover-text-accent" @click="expanded = true">⤢ 展开编辑</button>
      <span v-else></span>
      <span>{{ draft.length }}/500</span>
    </div>
    </template>

    <CommentComposerSheet v-model="draft" :open="expanded"
      :reply-to-name="replyTarget ? nicknameOf(replyTarget.user_id) : ''"
      :submitting="submitting" @submit="submit" @close="expanded = false" />
  </div>
</template>

<style scoped>
.comment-textarea {
  resize: none;
  max-height: 9rem;
  overflow-y: auto;
  line-height: 1.6;
  scrollbar-width: none;
}
.comment-textarea::-webkit-scrollbar { display: none; }
</style>
