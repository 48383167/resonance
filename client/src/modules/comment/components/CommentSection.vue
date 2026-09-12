<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { socket } from '../../../socket'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import { generateIdempotencyKey } from '../../../utils/idempotency'
import { listComments, createComment, removeComment } from '../comment.api.js'

const props = defineProps({
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
})

const comments = ref([])
const loading = ref(true)
const submitting = ref(false)
const draft = ref('')
const replyTarget = ref(null)
const inputRef = ref(null)
const collapsed = ref(false)
const expandedRoots = ref(new Set())

const roots = computed(() => comments.value.filter((c) => !c.parent_id))
const repliesOf = (parentId) => comments.value.filter((c) => c.parent_id === parentId)

const REPLY_PREVIEW = 2

function visibleReplies(rootId) {
  const list = repliesOf(rootId)
  if (expandedRoots.value.has(rootId) || list.length <= REPLY_PREVIEW) return list
  return list.slice(0, REPLY_PREVIEW)
}

function repliesToggleText(rootId) {
  if (expandedRoots.value.has(rootId)) return '收起回复'
  const hidden = repliesOf(rootId).length - REPLY_PREVIEW
  return hidden > 0 ? `展开其余 ${hidden} 条回复` : ''
}

function toggleReplies(rootId) {
  const next = new Set(expandedRoots.value)
  if (next.has(rootId)) next.delete(rootId)
  else next.add(rootId)
  expandedRoots.value = next
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
  if (target?.parent_id && !expandedRoots.value.has(target.parent_id)) {
    expandedRoots.value = new Set(expandedRoots.value).add(target.parent_id)
  }
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

async function load() {
  loading.value = true
  try {
    comments.value = await listComments(props.targetType, props.targetId)
  } catch (error) {
    toast(error.message || '评论加载失败', 'error')
  } finally {
    loading.value = false
  }
}

async function submit() {
  const content = draft.value.trim()
  if (!content || submitting.value) return
  submitting.value = true
  try {
    const payload = { targetType: props.targetType, targetId: props.targetId, content }
    if (replyTarget.value) payload.parentId = replyTarget.value.id
    const comment = await createComment(payload, generateIdempotencyKey())
    upsert(comment)
    draft.value = ''
    replyTarget.value = null
  } catch (error) {
    toast(error.message || '评论发送失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function startReply(comment) {
  replyTarget.value = comment
  await nextTick()
  inputRef.value?.focus()
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
      <div v-for="root in roots" :key="root.id" class="space-y-2">
        <div :id="commentDomId(root.id)" class="surface-soft rounded-xl px-3 py-2"
          :style="highlightId === root.id ? { boxShadow: '0 0 0 2px var(--accent)' } : null">
          <p v-if="root.deleted_at" class="text-sm italic text-theme-tertiary">该评论已删除</p>
          <template v-else>
            <div class="flex items-center gap-2 text-xs">
              <span class="text-accent">{{ root.author?.nickname || 'Ta' }}</span>
              <span class="text-theme-tertiary">{{ timeText(root.created_at) }}</span>
              <button v-if="root.user_id === session.userId"
                class="ml-auto text-rose-300/80 transition-colors hover:text-rose-300"
                @click="remove(root)">删除</button>
            </div>
            <p class="mt-1 break-words whitespace-pre-wrap text-sm leading-relaxed">{{ root.content }}</p>
            <div class="mt-1 text-xs text-theme-tertiary">
              <button class="transition-colors hover-text-accent" @click="startReply(root)">回复</button>
            </div>
          </template>
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
                  class="ml-auto text-rose-300/80 transition-colors hover:text-rose-300"
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

        <button v-if="repliesToggleText(root.id)" type="button"
          class="ml-4 text-xs text-theme-tertiary transition-colors hover-text-accent"
          @click="toggleReplies(root.id)">
          {{ repliesToggleText(root.id) }}
        </button>
      </div>
    </div>

    <div v-if="replyTarget" class="mt-2 flex items-center gap-2 text-xs text-theme-tertiary">
      <span>回复 @{{ nicknameOf(replyTarget.user_id) }}</span>
      <button class="transition-colors hover-text-accent" @click="cancelReply">✕ 取消</button>
    </div>

    <div class="mt-2 flex gap-2">
      <input ref="inputRef" v-model="draft" class="input-dark min-w-0 flex-1" maxlength="500"
        :placeholder="replyTarget ? `回复 @${nicknameOf(replyTarget.user_id)}…` : '写下你的评论…'"
        @keyup.enter="submit" />
      <button class="btn-primary shrink-0 px-4 py-2 text-sm"
        :disabled="!draft.trim() || submitting" @click="submit">
        {{ submitting ? '发送中…' : '发送' }}
      </button>
    </div>
    </template>
  </div>
</template>
