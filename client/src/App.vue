<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AmbientBackground from './shared/components/AmbientBackground.vue'
import MouseTrail from './shared/components/MouseTrail.vue'
import ImageLightbox from './shared/components/ImageLightbox.vue'
import ConfirmDialog from './shared/components/ConfirmDialog.vue'
import AppDock from './shared/components/AppDock.vue'
import MusicPlayer from './modules/music/components/MusicPlayer.vue'
import { session, initSession, logout } from './stores/session'
import { socket } from './socket'
import { toasts, toast } from './stores/toast'
import { loadCommentUnread, resetCommentUnread, bumpCommentUnread } from './stores/commentUnread'
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
  if (userId) loadCommentUnread()
  else resetCommentUnread()
}, { immediate: true })

// 对方的新评论让角标 +1；删除后重新拉取（负载不含作者与已读状态）
function onCommentCreated(comment) {
  if (!comment || comment.user_id === session.userId) return
  bumpCommentUnread(comment.target_type)
}

function onCommentDeleted() {
  loadCommentUnread()
}

function doLogout() {
  logout()
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
})

onUnmounted(() => {
  socket.off('user_presence')
  socket.off('comment:created', onCommentCreated)
  socket.off('comment:deleted', onCommentDeleted)
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
        <span class="max-w-32 truncate text-white/70">{{ session.me.nickname }}</span>
        <button class="min-h-10 shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10" @click="doLogout">
          退出
        </button>
      </div>
    </header>
    <main class="app-main mx-auto max-w-3xl px-4 pb-32" :class="{ 'app-main--companion': route.name === 'companion' }">
      <router-view />
    </main>

    <!-- 全局通知 -->
    <div class="app-toast pointer-events-none fixed left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
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
