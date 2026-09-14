<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  createMemory,
  createConversation,
  createMessage,
  getConsent,
  getConversation,
  listMemories,
  listConversations,
  removeMemory,
  removeConversation,
  updateMemory,
  updateConsent,
} from '../companion.api.js'
import { initSession, session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'

const consent = ref(null)
const memories = ref([])
const conversations = ref([])
const activeConversation = ref(null)
const messages = ref([])
const draft = ref('')
const busy = ref(false)
const loadingConversation = ref(false)
const messageList = ref(null)
const composerRef = ref(null)
const atBottom = ref(true)
const newMessagesHint = ref(false)
const historyOpen = ref(false)
const remainingToday = ref(null)
const pendingConversationCreation = ref(null)
const failedMessageRetry = ref(null)
const memoryOpen = ref(false)
const newMemory = ref('')
const creatingMemory = ref(false)
const memoryBusyId = ref('')
const editingMemoryId = ref('')
const editingMemoryContent = ref('')
const PENDING_CONVERSATION_STORAGE_KEY = 'resonance.companion.pending-conversation'
const PENDING_MESSAGE_STORAGE_KEY = 'resonance.companion.pending-message'
const activeMemoryCount = computed(() => memories.value.filter((memory) => memory.enabled).length)

// 触摸设备（手机）回车换行、按钮发送；桌面保留 Enter 发送
const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false
const composerPlaceholder = computed(() => (isTouchDevice
  ? '说说你现在的感受…'
  : '说说你现在的感受…（Enter 发送，Shift + Enter 换行）'))

function loadPending(key, userId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null')
    return value?.userId === userId ? value : null
  } catch {
    return null
  }
}

function savePending(key, value) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value))
    else sessionStorage.removeItem(key)
  } catch { /* 隐私模式或存储不可用时，退化为当前页面内重试 */ }
}

function setPendingConversationCreation(value) {
  pendingConversationCreation.value = value
  savePending(PENDING_CONVERSATION_STORAGE_KEY, value)
}

function setFailedMessageRetry(value) {
  failedMessageRetry.value = value
  savePending(PENDING_MESSAGE_STORAGE_KEY, value)
}

const NEAR_BOTTOM_PX = 80
const MAX_COMPOSER_HEIGHT = 144

// 只有贴底或显式强制时才滚到底，避免打断用户回看历史
function scrollToBottom(force = true) {
  nextTick(() => {
    const el = messageList.value
    if (!el) return
    if (!force && !atBottom.value) {
      newMessagesHint.value = true
      return
    }
    el.scrollTop = el.scrollHeight
    newMessagesHint.value = false
    atBottom.value = true
  })
}

function onListScroll() {
  const el = messageList.value
  if (!el) return
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  if (atBottom.value) newMessagesHint.value = false
}

// 输入框自动增高（约 1–5 行）
function autoGrow() {
  const el = composerRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`
}

// 中文输入法组合期间不触发发送；触摸设备回车换行，桌面 Enter 发送
function onComposerEnter(event) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.shiftKey || isTouchDevice) return
  event.preventDefault()
  sendMessage()
}

function closeSheets() {
  memoryOpen.value = false
  historyOpen.value = false
}

// 键盘弹起时按 visualViewport 收缩全屏容器，保证输入条不被遮挡；顶栏高度实测后供高度计算
function syncAppViewport() {
  const viewport = window.visualViewport
  if (viewport) {
    document.documentElement.style.setProperty('--app-vvh', `${Math.round(viewport.height)}px`)
  }
  const header = document.querySelector('header')
  if (header) {
    document.documentElement.style.setProperty('--app-header-h', `${Math.round(header.offsetHeight)}px`)
  }
}

function onViewportResize() {
  syncAppViewport()
  if (atBottom.value) scrollToBottom(true)
}

watch(draft, () => nextTick(autoGrow))

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function moveConversationToTop(updated) {
  const index = conversations.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) conversations.value.splice(index, 1)
  conversations.value.unshift(updated)
}

function sortMemories() {
  memories.value.sort((left, right) => {
    if (left.enabled !== right.enabled) return Number(right.enabled) - Number(left.enabled)
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

function replaceMemory(updated) {
  const index = memories.value.findIndex((memory) => memory.id === updated.id)
  if (index >= 0) memories.value.splice(index, 1, updated)
  else memories.value.push(updated)
  sortMemories()
}

async function addMemory() {
  const content = newMemory.value.trim()
  if (!content || creatingMemory.value) return
  creatingMemory.value = true
  try {
    const created = await createMemory({ content }, generateIdempotencyKey())
    replaceMemory(created)
    newMemory.value = ''
    toast('已保存并启用这条记忆')
  } catch (error) {
    toast(error.message)
  } finally {
    creatingMemory.value = false
  }
}

function startEditingMemory(memory) {
  editingMemoryId.value = memory.id
  editingMemoryContent.value = memory.content
}

function cancelEditingMemory() {
  editingMemoryId.value = ''
  editingMemoryContent.value = ''
}

async function saveMemoryEdit(memory) {
  const content = editingMemoryContent.value.trim()
  if (!content || memoryBusyId.value) return
  memoryBusyId.value = memory.id
  try {
    replaceMemory(await updateMemory(memory.id, { content }))
    cancelEditingMemory()
    toast('记忆已更新')
  } catch (error) {
    toast(error.message)
  } finally {
    memoryBusyId.value = ''
  }
}

async function toggleMemory(memory) {
  if (memoryBusyId.value) return
  memoryBusyId.value = memory.id
  try {
    const updated = await updateMemory(memory.id, { enabled: !memory.enabled })
    replaceMemory(updated)
    toast(updated.enabled ? '这条记忆已启用' : '这条记忆已暂停')
  } catch (error) {
    toast(error.message)
  } finally {
    memoryBusyId.value = ''
  }
}

async function deleteMemory(memory) {
  if (memoryBusyId.value) return
  const confirmed = await confirmDialog({
    title: '删除这条记忆？',
    message: '删除后，后续咨询将不再使用它；已经发送给模型的历史请求无法撤回。',
  })
  if (!confirmed) return
  memoryBusyId.value = memory.id
  try {
    await removeMemory(memory.id)
    memories.value = memories.value.filter((item) => item.id !== memory.id)
    if (editingMemoryId.value === memory.id) cancelEditingMemory()
    toast('这条记忆已删除')
  } catch (error) {
    toast(error.message)
  } finally {
    memoryBusyId.value = ''
  }
}

async function selectConversation(conversation) {
  if (loadingConversation.value || busy.value) return
  historyOpen.value = false
  newMessagesHint.value = false
  atBottom.value = true
  loadingConversation.value = true
  try {
    const detail = await getConversation(conversation.id)
    activeConversation.value = detail.conversation
    messages.value = detail.messages
    scrollToBottom()
  } catch (error) {
    toast(error.message)
  } finally {
    loadingConversation.value = false
  }
}

async function startConversation() {
  historyOpen.value = false
  const pending = pendingConversationCreation.value || {
    userId: session.userId,
    idempotencyKey: generateIdempotencyKey(),
  }
  const idempotencyKey = pending.idempotencyKey
  setPendingConversationCreation(pending)
  try {
    const created = await createConversation({ title: '新的倾诉' }, idempotencyKey)
    setPendingConversationCreation(null)
    moveConversationToTop(created)
    activeConversation.value = created
    messages.value = []
    return created
  } catch (error) {
    // 网络超时后复用同一键重试，避免服务端已创建但客户端未收到响应时产生重复会话。
    toast(error.message)
    return null
  }
}

async function acceptConsent() {
  try {
    consent.value = await updateConsent(true)
    toast('你可以开始说说现在的感受了')
  } catch (error) {
    toast(error.message)
  }
}

async function withdrawConsent() {
  const confirmed = await confirmDialog({
    title: '停止使用情感助手？',
    message: '停止后将不再发送新消息给模型；已保存的本地对话不会自动删除。',
    danger: false,
  })
  if (!confirmed) return
  try {
    consent.value = await updateConsent(false)
    memoryOpen.value = false
    toast('已停止发送新消息')
  } catch (error) {
    toast(error.message)
  }
}

async function sendMessage() {
  const content = draft.value.trim()
  if (!content || busy.value || !consent.value?.consented) return

  let conversation = activeConversation.value
  if (!conversation) {
    conversation = await startConversation()
    if (!conversation) return
  }

  const temporaryMessage = {
    id: `pending-${Date.now()}`,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
    pending: true,
  }
  const originalDraft = draft.value
  const retry = failedMessageRetry.value?.conversationId === conversation.id
    && failedMessageRetry.value?.content === content
    ? failedMessageRetry.value
    : { userId: session.userId, conversationId: conversation.id, content, idempotencyKey: generateIdempotencyKey() }
  const idempotencyKey = retry.idempotencyKey
  // 在请求发出前保存，刷新或离开页面后仍可对同一逻辑提交使用相同键重放。
  setFailedMessageRetry(retry)
  draft.value = ''
  messages.value.push(temporaryMessage)
  busy.value = true
  scrollToBottom()

  try {
    const result = await createMessage(conversation.id, { content }, idempotencyKey)
    setFailedMessageRetry(null)
    const pendingIndex = messages.value.findIndex((message) => message.id === temporaryMessage.id)
    if (pendingIndex >= 0) messages.value.splice(pendingIndex, 1, result.userMessage, result.assistantMessage)
    else messages.value.push(result.userMessage, result.assistantMessage)
    remainingToday.value = result.remainingToday
    // 首条消息后服务端会自动命名，直接采用返回的最新会话
    const updatedConversation = result.conversation || { ...conversation, updatedAt: result.assistantMessage.createdAt }
    activeConversation.value = updatedConversation
    moveConversationToTop(updatedConversation)
    scrollToBottom(false)
  } catch (error) {
    // 对相同内容的再次发送复用键，安全重放已完成但未送达浏览器的响应。
    messages.value = messages.value.filter((message) => message.id !== temporaryMessage.id)
    if (!draft.value) draft.value = originalDraft
    toast(error.message)
  } finally {
    busy.value = false
  }
}

async function deleteActiveConversation() {
  if (!activeConversation.value || busy.value) return
  const confirmed = await confirmDialog({
    title: '删除这段倾诉？',
    message: '这会从共鸣的本地数据库中永久删除整段对话，无法恢复。已经发送给模型的内容无法被撤回。',
  })
  if (!confirmed) return
  try {
    const deletedId = activeConversation.value.id
    await removeConversation(deletedId)
    conversations.value = conversations.value.filter((conversation) => conversation.id !== deletedId)
    activeConversation.value = null
    messages.value = []
    remainingToday.value = null
    if (failedMessageRetry.value?.conversationId === deletedId) setFailedMessageRetry(null)
    if (conversations.value[0]) await selectConversation(conversations.value[0])
    toast('这段倾诉已删除')
  } catch (error) {
    toast(error.message)
  }
}

onMounted(async () => {
  syncAppViewport()
  window.visualViewport?.addEventListener('resize', onViewportResize)
  if (!session.me) await initSession()
  try {
    pendingConversationCreation.value = loadPending(PENDING_CONVERSATION_STORAGE_KEY, session.userId)
    const restoredMessage = loadPending(PENDING_MESSAGE_STORAGE_KEY, session.userId)
    if (restoredMessage?.conversationId && typeof restoredMessage.content === 'string') {
      failedMessageRetry.value = restoredMessage
      draft.value = restoredMessage.content
    }
    const [consentState, items, memoryItems] = await Promise.all([getConsent(), listConversations(), listMemories()])
    consent.value = consentState
    conversations.value = items
    memories.value = memoryItems
    const retryConversation = items.find((item) => item.id === restoredMessage?.conversationId)
    if (retryConversation) await selectConversation(retryConversation)
    else if (restoredMessage) setFailedMessageRetry(null)
    else if (items[0]) await selectConversation(items[0])
  } catch (error) {
    toast(error.message)
  }
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
  document.documentElement.style.removeProperty('--app-vvh')
  document.documentElement.style.removeProperty('--app-header-h')
})
</script>

<template>
  <div class="fade-up space-y-4" :class="{ 'companion-page': consent?.consented }">
    <section class="glass hidden overflow-hidden p-5 sm:p-6 md:block">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs tracking-[0.18em] text-accent">PRIVATE COMPANION</p>
          <h2 class="serif mt-1 text-2xl">心语陪伴</h2>
          <p class="mt-2 max-w-xl text-sm leading-6 text-theme-secondary">只听你说，陪你理清感受与关系里的话。不读取日记，也不会把对话告诉 Ta。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" :aria-expanded="memoryOpen" @click="memoryOpen = !memoryOpen">
            我的记忆 <span class="ml-1 text-theme-tertiary">{{ activeMemoryCount }}</span>
          </button>
          <button v-if="consent?.consented" class="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" @click="withdrawConsent">停止使用</button>
        </div>
      </div>
    </section>

    <div v-if="memoryOpen || historyOpen" class="companion-sheet-mask md:hidden" @click="closeSheets" />

    <section v-if="memoryOpen" class="companion-memory-sheet glass space-y-4 p-5 sm:p-6">
      <div class="flex items-center justify-end md:hidden">
        <button type="button" class="text-xs text-theme-tertiary transition-colors hover-text-accent" @click="memoryOpen = false">收起</button>
      </div>
      <div>
        <p class="text-xs tracking-[0.18em] text-accent">MY MEMORY</p>
        <h3 class="serif mt-1 text-xl">我的相处偏好</h3>
        <p class="mt-2 text-sm leading-6 text-theme-secondary">由你主动保存、仅你可见。启用后会在你发送正常情感咨询时作为简短背景发送给模型；不会自动读取日记或情书，危机求助也不会使用它。</p>
      </div>

      <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="addMemory">
        <input v-model="newMemory" maxlength="160" class="input-dark flex-1 text-sm" :disabled="creatingMemory"
          placeholder="例如：我希望先被倾听，再讨论解决方案" aria-label="新增个人记忆" />
        <button class="btn-primary shrink-0 !px-4 text-sm" :disabled="creatingMemory || !newMemory.trim()">
          {{ creatingMemory ? '保存中…' : '保存并启用' }}
        </button>
      </form>
      <p class="text-xs text-theme-tertiary">已启用 {{ activeMemoryCount }} 条 · 单条最多 160 字。达到启用上限时，请先暂停一条；暂停或删除后，后续咨询不会再使用它。</p>

      <div v-if="!memories.length" class="surface-soft rounded-2xl p-4 text-sm text-theme-secondary">还没有记忆。只保存你希望助手长期记住的相处偏好，不必记录具体隐私细节。</div>
      <div v-else class="space-y-2">
        <article v-for="memory in memories" :key="memory.id" class="surface-soft rounded-2xl p-3 sm:p-4">
          <template v-if="editingMemoryId === memory.id">
            <textarea v-model="editingMemoryContent" maxlength="160" rows="3" class="companion-textarea input-dark min-h-20 resize-y text-sm" :disabled="memoryBusyId === memory.id" />
            <div class="mt-2 flex justify-end gap-2">
              <button class="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" :disabled="memoryBusyId === memory.id" @click="cancelEditingMemory">取消</button>
              <button class="btn-primary !min-h-9 !px-3 !py-1.5 text-xs" :disabled="memoryBusyId === memory.id || !editingMemoryContent.trim()" @click="saveMemoryEdit(memory)">保存</button>
            </div>
          </template>
          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <p class="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-theme-primary">{{ memory.content }}</p>
              <span class="shrink-0 rounded-full px-2 py-1 text-[10px]" :class="memory.enabled ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-tertiary'">
                {{ memory.enabled ? '启用中' : '已暂停' }}
              </span>
            </div>
            <div class="mt-3 flex flex-wrap justify-end gap-2">
              <button class="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" :disabled="memoryBusyId === memory.id" @click="startEditingMemory(memory)">编辑</button>
              <button class="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" :disabled="memoryBusyId === memory.id" @click="toggleMemory(memory)">
                {{ memory.enabled ? '暂停' : '启用' }}
              </button>
              <button class="danger-action min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors" :disabled="memoryBusyId === memory.id" @click="deleteMemory(memory)">删除</button>
            </div>
          </template>
        </article>
      </div>
      <button v-if="consent?.consented" class="btn-ghost w-full text-sm md:hidden" @click="withdrawConsent">停止使用</button>
    </section>

    <section v-if="consent && !consent.consented" class="glass space-y-4 p-5 sm:p-6">
      <div class="flex gap-3">
        <span class="mt-0.5 text-xl">☾</span>
        <div>
          <h3 class="font-medium">开始前的一点说明</h3>
          <p class="mt-2 text-sm leading-6 text-theme-secondary">你主动输入的消息，以及你主动保存并启用的个人记忆，会发送给 DeepSeek 生成回复。聊天仅你自己可见；助手只处理情感与关系沟通，不替代心理诊疗或紧急援助。</p>
        </div>
      </div>
      <button class="btn-primary w-full sm:w-auto" @click="acceptConsent">我已了解，开始倾诉</button>
    </section>

    <section v-else-if="consent" class="companion-layout glass overflow-hidden">
      <aside class="companion-sidebar border-b border-theme p-3 md:border-b-0 md:border-r" :class="{ 'is-open': historyOpen }">
        <div class="mb-2 flex items-center justify-between md:hidden">
          <span class="text-sm font-medium">倾诉记录</span>
          <button type="button" class="text-xs text-theme-tertiary transition-colors hover-text-accent" @click="historyOpen = false">收起</button>
        </div>
        <button class="btn-primary w-full !px-3 text-sm" :disabled="busy" @click="startConversation">＋ 新的倾诉</button>
        <div class="mt-3 space-y-1 md:min-h-0 md:flex-1 md:overflow-y-auto">
          <button v-for="conversation in conversations" :key="conversation.id"
            class="block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors"
            :class="activeConversation?.id === conversation.id ? 'bg-accent-soft text-accent' : 'text-theme-secondary surface-hover hover:text-theme-primary'"
            :disabled="busy" @click="selectConversation(conversation)">
            <span class="block truncate">{{ conversation.title }}</span>
            <span class="mt-0.5 block text-[10px] text-theme-tertiary">{{ formatTime(conversation.updatedAt) }}</span>
          </button>
        </div>
      </aside>

      <div class="companion-chat flex min-w-0 flex-1 flex-col">
        <div class="flex items-center gap-2 border-b border-theme px-4 py-3 sm:px-5">
          <button type="button" class="companion-header-btn md:hidden" aria-label="倾诉记录" @click="historyOpen = true">☰</button>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ activeConversation?.title || '新的倾诉' }}</p>
            <p class="mt-0.5 text-[11px] text-theme-tertiary">仅限情感咨询 · 仅本人可见</p>
          </div>
          <button type="button" class="companion-header-btn md:hidden" aria-label="我的记忆" @click="memoryOpen = true">
            记忆<span v-if="activeMemoryCount" class="ml-1 text-accent">{{ activeMemoryCount }}</span>
          </button>
          <button v-if="activeConversation" class="danger-link shrink-0 text-xs transition-colors" :disabled="busy" @click="deleteActiveConversation">删除</button>
        </div>

        <div class="relative flex min-h-0 flex-1 flex-col">
          <div ref="messageList" class="companion-message-list min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
            @scroll.passive="onListScroll">
            <div v-if="!activeConversation && !loadingConversation" class="flex h-full min-h-60 flex-col items-center justify-center text-center text-theme-tertiary">
              <span class="text-3xl">✦</span>
              <p class="mt-3 text-sm">现在的你，想从哪里说起？</p>
              <p class="mt-1 text-xs">说一句话就会开始一段新的倾诉。</p>
            </div>
            <div v-for="message in messages" :key="message.id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%]"
                :class="message.role === 'user' ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-[var(--accent-contrast)]' : 'surface-soft text-theme-primary'">
                <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
                <p class="mt-1 text-right text-[10px] opacity-55">{{ message.pending ? '正在发送…' : formatTime(message.createdAt) }}</p>
              </div>
            </div>
            <div v-if="busy" class="flex justify-start">
              <div class="surface-soft rounded-2xl px-4 py-3 text-xs text-theme-secondary">正在认真听你说…</div>
            </div>
          </div>
          <button v-if="newMessagesHint" type="button"
            class="companion-new-messages absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs font-medium"
            @click="scrollToBottom(true)">↓ 新消息</button>
        </div>

        <div class="border-t border-theme p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-4">
          <div class="companion-composer surface-soft rounded-2xl border border-theme p-2 focus-within:border-[var(--accent)]">
            <textarea ref="composerRef" v-model="draft" rows="1" maxlength="2000"
              class="companion-textarea w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none"
              :placeholder="composerPlaceholder" :enterkeyhint="isTouchDevice ? 'enter' : 'send'"
              @keydown.enter="onComposerEnter" @input="autoGrow" />
            <div class="flex items-center justify-between gap-3 px-2 pb-1 pt-1">
              <span class="text-[10px] text-theme-tertiary">{{ draft.length }}/2000<span v-if="remainingToday != null"> · 今日还可咨询 {{ remainingToday }} 次</span></span>
              <button class="btn-primary !min-h-9 !px-4 !py-1.5 text-sm" :disabled="busy || !draft.trim()" @click="sendMessage">
                {{ busy ? '倾听中…' : '发送' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.companion-layout { display: flex; flex-direction: column; }
.companion-sidebar { max-height: 12rem; }
.companion-chat { flex: 0 0 auto; height: clamp(20rem, calc(100dvh - 10rem), 34rem); }
.companion-message-list { overscroll-behavior: contain; }
.companion-textarea { color: var(--text-primary); overflow-y: auto; }
.companion-textarea::placeholder { color: rgb(var(--text-secondary-rgb) / 0.58); }

.companion-header-btn {
  display: inline-flex;
  min-height: 2rem;
  flex-shrink: 0;
  align-items: center;
  border: 1px solid rgb(var(--border-subtle-rgb) / var(--glass-border-alpha));
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  color: var(--text-secondary);
  font-size: 0.7rem;
  transition: color 0.2s ease, background 0.2s ease;
}
.companion-header-btn:active { background: rgb(var(--text-primary-rgb) / 0.08); }

@media (hover: hover) {
  .companion-header-btn:hover { background: rgb(var(--text-primary-rgb) / 0.08); color: var(--text-primary); }
}

.companion-new-messages {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--accent-contrast);
  box-shadow: 0 6px 20px rgb(var(--accent-rgb) / 0.35);
}

@media (max-width: 767px) {
  .companion-page {
    position: relative;
    display: flex;
    flex-direction: column;
    height: calc(var(--app-vvh, 100svh) - var(--app-header-h, 4rem));
    overflow: hidden;
  }
  .companion-page > .companion-layout { flex: 1 1 auto; min-height: 0; margin-top: 0; }
  .companion-chat { flex: 1 1 0%; height: auto; min-height: 0; }
  .companion-sidebar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: none;
    max-height: min(72%, 32rem);
    overflow-y: auto;
    border-radius: 1.25rem 1.25rem 0 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    background: var(--page-bg);
    box-shadow: 0 -12px 40px rgb(var(--shadow-rgb) / 0.35);
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
  .companion-sidebar.is-open { display: block; }
  .companion-memory-sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    max-height: min(80%, 40rem);
    overflow-y: auto;
    border-radius: 1.25rem 1.25rem 0 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    background: var(--page-bg);
    box-shadow: 0 -12px 40px rgb(var(--shadow-rgb) / 0.35);
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
  }
  .companion-memory-sheet .input-dark { font-size: 1rem; }
  .companion-sheet-mask {
    position: absolute;
    inset: 0;
    z-index: 20;
    background: rgb(0 0 0 / 0.5);
  }
  .companion-textarea { font-size: 1rem; line-height: 1.6; }
}

@media (min-width: 768px) {
  .companion-layout { min-height: 36rem; flex-direction: row; }
  .companion-sidebar { display: flex; flex-direction: column; width: 12.5rem; max-height: 42rem; flex: 0 0 12.5rem; }
  .companion-chat { flex: 1 1 0%; height: clamp(24rem, calc(100dvh - 8rem), 42rem); }
}
</style>
