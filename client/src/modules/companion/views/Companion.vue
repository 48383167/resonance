<script setup>
import { nextTick, onMounted, ref } from 'vue'
import {
  createConversation,
  createMessage,
  getConsent,
  getConversation,
  listConversations,
  removeConversation,
  updateConsent,
} from '../companion.api.js'
import { initSession, session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'

const consent = ref(null)
const conversations = ref([])
const activeConversation = ref(null)
const messages = ref([])
const draft = ref('')
const busy = ref(false)
const loadingConversation = ref(false)
const messageList = ref(null)
const remainingToday = ref(null)
const pendingConversationCreation = ref(null)
const failedMessageRetry = ref(null)
const PENDING_CONVERSATION_STORAGE_KEY = 'resonance.companion.pending-conversation'
const PENDING_MESSAGE_STORAGE_KEY = 'resonance.companion.pending-message'

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

function scrollToBottom() {
  nextTick(() => {
    if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  })
}

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function moveConversationToTop(updated) {
  const index = conversations.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) conversations.value.splice(index, 1)
  conversations.value.unshift(updated)
}

async function selectConversation(conversation) {
  if (loadingConversation.value || busy.value) return
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
    const updatedConversation = { ...conversation, updatedAt: result.assistantMessage.createdAt }
    activeConversation.value = updatedConversation
    moveConversationToTop(updatedConversation)
    scrollToBottom()
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
  if (!session.me) await initSession()
  try {
    pendingConversationCreation.value = loadPending(PENDING_CONVERSATION_STORAGE_KEY, session.userId)
    const restoredMessage = loadPending(PENDING_MESSAGE_STORAGE_KEY, session.userId)
    if (restoredMessage?.conversationId && typeof restoredMessage.content === 'string') {
      failedMessageRetry.value = restoredMessage
      draft.value = restoredMessage.content
    }
    const [consentState, items] = await Promise.all([getConsent(), listConversations()])
    consent.value = consentState
    conversations.value = items
    const retryConversation = items.find((item) => item.id === restoredMessage?.conversationId)
    if (retryConversation) await selectConversation(retryConversation)
    else if (restoredMessage) setFailedMessageRetry(null)
    else if (items[0]) await selectConversation(items[0])
  } catch (error) {
    toast(error.message)
  }
})
</script>

<template>
  <div class="fade-up space-y-4">
    <section class="glass overflow-hidden p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs tracking-[0.18em] text-accent">PRIVATE COMPANION</p>
          <h2 class="serif mt-1 text-2xl">心语陪伴</h2>
          <p class="mt-2 max-w-xl text-sm leading-6 text-white/60">只听你说，陪你理清感受与关系里的话。不读取日记，也不会把对话告诉 Ta。</p>
        </div>
        <button v-if="consent?.consented" class="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" @click="withdrawConsent">停止使用</button>
      </div>
    </section>

    <section v-if="consent && !consent.consented" class="glass space-y-4 p-5 sm:p-6">
      <div class="flex gap-3">
        <span class="mt-0.5 text-xl">☾</span>
        <div>
          <h3 class="font-medium">开始前的一点说明</h3>
          <p class="mt-2 text-sm leading-6 text-white/60">你主动输入的消息会发送给 DeepSeek 生成回复。聊天仅你自己可见；助手只处理情感与关系沟通，不替代心理诊疗或紧急援助。</p>
        </div>
      </div>
      <button class="btn-primary w-full sm:w-auto" @click="acceptConsent">我已了解，开始倾诉</button>
    </section>

    <section v-else-if="consent" class="companion-layout glass overflow-hidden">
      <aside class="companion-sidebar border-b border-white/10 p-3 md:border-b-0 md:border-r">
        <button class="btn-primary w-full !px-3 text-sm" :disabled="busy" @click="startConversation">＋ 新的倾诉</button>
        <div class="mt-3 flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-y-auto md:pb-0">
          <button v-for="conversation in conversations" :key="conversation.id"
            class="min-w-32 rounded-xl px-3 py-2 text-left text-sm transition-colors md:block md:w-full"
            :class="activeConversation?.id === conversation.id ? 'bg-white/12 text-accent' : 'text-white/60 hover:bg-white/8 hover:text-white'"
            :disabled="busy" @click="selectConversation(conversation)">
            <span class="block truncate">{{ conversation.title }}</span>
            <span class="mt-0.5 block text-[10px] text-white/35">{{ formatTime(conversation.updatedAt) }}</span>
          </button>
        </div>
      </aside>

      <div class="flex min-h-[34rem] min-w-0 flex-1 flex-col">
        <div class="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">{{ activeConversation?.title || '新的倾诉' }}</p>
            <p class="mt-0.5 text-[11px] text-white/40">仅限情感咨询 · 仅本人可见</p>
          </div>
          <button v-if="activeConversation" class="shrink-0 text-xs text-white/40 transition-colors hover:text-rose-300" :disabled="busy" @click="deleteActiveConversation">删除</button>
        </div>

        <div ref="messageList" class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div v-if="!activeConversation && !loadingConversation" class="flex h-full min-h-60 flex-col items-center justify-center text-center text-white/45">
            <span class="text-3xl">✦</span>
            <p class="mt-3 text-sm">现在的你，想从哪里说起？</p>
            <p class="mt-1 text-xs">说一句话就会开始一段新的倾诉。</p>
          </div>
          <div v-for="message in messages" :key="message.id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%]"
              :class="message.role === 'user' ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-[var(--accent-contrast)]' : 'bg-white/[0.08] text-white/85'">
              <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
              <p class="mt-1 text-right text-[10px] opacity-55">{{ message.pending ? '正在发送…' : formatTime(message.createdAt) }}</p>
            </div>
          </div>
          <div v-if="busy" class="flex justify-start">
            <div class="rounded-2xl bg-white/[0.08] px-4 py-3 text-xs text-white/55">正在认真听你说…</div>
          </div>
        </div>

        <div class="border-t border-white/10 p-3 sm:p-4">
          <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-2 focus-within:border-[var(--accent)]">
            <textarea v-model="draft" rows="3" maxlength="2000" class="w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-white/35"
              :disabled="busy" placeholder="说说你现在的感受…（Enter 发送，Shift + Enter 换行）"
              @keydown.enter.exact.prevent="sendMessage" />
            <div class="flex items-center justify-between gap-3 px-2 pb-1 pt-1">
              <span class="text-[10px] text-white/35">{{ draft.length }}/2000<span v-if="remainingToday != null"> · 今日还可咨询 {{ remainingToday }} 次</span></span>
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
@media (min-width: 768px) {
  .companion-layout { min-height: 36rem; flex-direction: row; }
  .companion-sidebar { width: 12.5rem; max-height: 42rem; flex: 0 0 12.5rem; }
}
</style>
