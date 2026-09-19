<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AmbientBackground from './shared/components/AmbientBackground.vue'
import MouseTrail from './shared/components/MouseTrail.vue'
import ImageLightbox from './shared/components/ImageLightbox.vue'
import ConfirmDialog from './shared/components/ConfirmDialog.vue'
import AppDock from './shared/components/AppDock.vue'
import MusicPlayer from './modules/music/components/MusicPlayer.vue'
import PinnedBanner from './shared/components/PinnedBanner.vue'
import { session, initSession, logout } from './stores/session'
import { clearAllCommentDrafts } from './modules/comment/commentDraft.js'
import { clearAllFormDrafts } from './utils/draft.js'
import { socket } from './socket'
import { toasts, toast } from './stores/toast'
import { loadCommentUnread, resetCommentUnread, bumpCommentUnread } from './stores/commentUnread'
import { loadGlobalPins, resetPins } from './stores/pins'
import { loadNotebookUnread, resetNotebookUnread, bumpNotebookUnread } from './stores/notebookUnread'
import { loadDock, resetDock, applyDock } from './stores/dock'
import { currentTheme, loadTheme, resetTheme } from './stores/theme'

const router = useRouter()
const route = useRoute()
const shellColors = computed(() => currentTheme.pageColors)

watch(() => [session.me?.id, route.meta.auth], ([userId, isPrivateRoute]) => {
  if (userId && isPrivateRoute) loadTheme(userId)
  else resetTheme()
}, { immediate: true })

// 登录后拉取评论未读角标，退出时清零
watch(() => session.userId, (userId) => {
  if (userId) { loadCommentUnread(); loadGlobalPins(); loadNotebookUnread(); loadDock() }
  else { resetCommentUnread(); resetPins(); resetNotebookUnread(); resetDock() }
}, { immediate: true })

// 对方的新评论让角标 +1；删除后重新拉取（负载不含作者与已读状态）
function onCommentCreated(comment) {
  if (!comment || comment.user_id === session.userId) return
  bumpCommentUnread(comment.target_type)
}

function onCommentDeleted() {
  loadCommentUnread()
}
function onPinUpdated() { loadGlobalPins() }
function onRuleCreated(rule) {
  if (rule?.author_id !== session.userId) { bumpNotebookUnread(); toast('Ta 提出了新规矩，去小本本看看') }
}
function onRuleChanged() {
  loadNotebookUnread()
}
// 底部导航为两人共用设置：对方修改后实时套用
function onNavigationUpdated(payload) {
  applyDock(payload?.items)
}
function onProfileUpdated(payload) {
  if (!session.me) return
  // 事件由「设置性别的一方」触发，payload 同时携带双方最新性别
  const mine = payload.actorId === session.me.id ? payload.gender : payload.partnerGender
  const theirs = payload.actorId === session.me.id ? payload.partnerGender : payload.gender
  session.me.gender = mine
  if (session.partner) session.partner.gender = theirs
  if (payload.actorId !== session.userId && payload.partnerId === session.userId) {
    const label = payload.partnerGender === 'male' ? '男' : payload.partnerGender === 'female' ? '女' : payload.partnerGender
    toast(`Ta 设置了性别，你的已自动同步为${label}`)
  }
}
function onRuleAgreed(payload) {
  loadNotebookUnread()
  const rule = payload?.rule
  // 仅对方操作时提示，避免自己撤回认同也收到「Ta 认同了」
  if (rule?.author_id === session.userId && payload?.actorId !== session.userId) {
    toast(`Ta 认同了你的约定：${rule.title}`)
  }
}
function onRuleItemAdded(payload) {
  loadNotebookUnread()
  const rule = payload?.rule
  if (rule && payload?.actorId && payload.actorId !== session.userId) {
    toast(`Ta 在「${rule.title}」里加了一条`)
  }
}
function onRuleItemAgreed(payload) {
  loadNotebookUnread()
  if (payload?.actorId && payload.actorId !== session.userId && payload?.item?.text) {
    toast(`Ta 认同了「${payload.item.text.slice(0, 12)}${payload.item.text.length > 12 ? '…' : ''}」`)
  }
}

function doLogout() {
  logout()
  clearAllCommentDrafts()
  clearAllFormDrafts()
  router.push('/login')
}

onMounted(() => {
  initSession()
  socket.on('user_presence', (p) => {
    if (p.online && p.userId !== session.userId) {
      session.partnerOnline = true
      if (p.nickname) toast(`${p.nickname} 上线了`)
    } else if (!p.online && p.userId !== session.userId) {
      session.partnerOnline = false
      if (p.nickname) toast(`${p.nickname} 下线了`)
    }
  })
  socket.on('comment:created', onCommentCreated)
  socket.on('comment:deleted', onCommentDeleted)
  socket.on('pin:updated', onPinUpdated)
  socket.on('rule:created', onRuleCreated)
  socket.on('rule:updated', onRuleChanged)
  socket.on('rule:deleted', onRuleChanged)
  socket.on('rule:agreed', onRuleAgreed)
  socket.on('rule:item_added', onRuleItemAdded)
  socket.on('rule:item_agreed', onRuleItemAgreed)
  socket.on('profile:updated', onProfileUpdated)
  socket.on('navigation:updated', onNavigationUpdated)
})

onUnmounted(() => {
  socket.off('user_presence')
  socket.off('comment:created', onCommentCreated)
  socket.off('comment:deleted', onCommentDeleted)
  socket.off('pin:updated', onPinUpdated)
  socket.off('rule:created', onRuleCreated)
  socket.off('rule:updated', onRuleChanged)
  socket.off('rule:deleted', onRuleChanged)
  socket.off('rule:agreed', onRuleAgreed)
  socket.off('rule:item_added', onRuleItemAdded)
  socket.off('rule:item_agreed', onRuleItemAgreed)
  socket.off('profile:updated', onProfileUpdated)
  socket.off('navigation:updated', onNavigationUpdated)
})
</script>

<template>
  <MouseTrail />
  <AmbientBackground :colors="shellColors" :opacity="0.5" />
  <ImageLightbox />
  <ConfirmDialog />
  <MusicPlayer v-if="session.me" />
  <div class="relative min-h-full">
    <header v-if="session.me" class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
      <router-link to="/home" class="flex min-w-0 items-center gap-2">
        <span class="text-xl">♫</span>
        <span class="serif text-lg">共鸣</span>
      </router-link>
      <div class="flex min-w-0 items-center gap-2 text-sm sm:gap-3">
        <span class="max-w-32 truncate text-theme-secondary">{{ session.me.nickname }}</span>
        <button class="min-h-10 shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10" @click="doLogout">
          退出
        </button>
      </div>
    </header>
    <PinnedBanner />
    <main class="app-main mx-auto max-w-3xl px-4 pb-32" :class="{ 'app-main--companion': route.name === 'companion' }">
      <router-view />
    </main>

    <!-- 全局通知 -->
    <div class="app-toast pointer-events-none fixed left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      <TransitionGroup name="toast">
           <div v-for="t in toasts" :key="t.id"
            class="glass pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 break-words px-4 py-2.5 text-center text-sm shadow-xl">
           <span class="h-2 w-2 rounded-full"
            :style="{ background: t.type === 'info' ? 'var(--accent-2)' : 'var(--accent)' }" />
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
    <AppDock v-if="session.me" :class="{ 'app-dock--companion': route.name === 'companion' }" />
  </div>
</template>

<style>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }

.app-toast { bottom: 1.5rem; }
.app-main { padding-bottom: calc(8rem + env(safe-area-inset-bottom)); }
@media (max-width: 640px) {
  .app-toast { bottom: calc(5.75rem + env(safe-area-inset-bottom)); }
}

/* 心语陪伴移动端：全屏聊天，隐藏底部导航并去掉底部留白 */
@media (max-width: 767px) {
  .app-main--companion { padding-bottom: 0; }
  .app-dock--companion { display: none; }
}
</style>
