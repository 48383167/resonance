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
import { currentTheme, loadTheme, resetTheme } from './stores/theme'

const router = useRouter()
const route = useRoute()
const shellColors = computed(() => currentTheme.pageColors)

watch(() => [session.me?.id, route.meta.auth], ([userId, isPrivateRoute]) => {
  if (userId && isPrivateRoute) loadTheme(userId)
  else resetTheme()
}, { immediate: true })

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
})

onUnmounted(() => {
  socket.off('user_presence')
})
</script>

<template>
  <MouseTrail />
  <AmbientBackground :colors="shellColors" :opacity="0.5" />
  <ImageLightbox />
  <ConfirmDialog />
  <MusicPlayer v-if="session.me" />
  <div class="relative min-h-full">
    <header v-if="session.me" class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
      <router-link to="/home" class="flex items-center gap-2">
        <span class="text-xl">♫</span>
        <span class="serif text-lg">共鸣</span>
      </router-link>
      <div class="flex items-center gap-3 text-sm">
        <span class="max-w-32 truncate text-white/70">{{ session.me.nickname }}</span>
        <button class="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10" @click="doLogout">
          退出
        </button>
      </div>
    </header>
    <main class="mx-auto max-w-3xl px-4 pb-32">
      <router-view />
    </main>

    <!-- 全局通知 -->
    <div class="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <TransitionGroup name="toast">
          <div v-for="t in toasts" :key="t.id"
           class="glass pointer-events-auto flex items-center gap-2 px-4 py-2.5 text-sm shadow-xl">
           <span class="h-2 w-2 rounded-full"
            :style="{ background: t.type === 'info' ? 'var(--accent-2)' : 'var(--accent)' }" />
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
    <AppDock v-if="session.me" />
  </div>
</template>

<style>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }
</style>
