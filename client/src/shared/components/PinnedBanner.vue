<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session } from '../../stores/session'
import { pins } from '../../stores/pins'

// 全站置顶细横幅：单行横向滑动，移动端友好；会话内可关闭
const route = useRoute()
const router = useRouter()
const DISMISS_KEY = 'resonance.pins.dismissed'

const dismissed = ref(sessionStorage.getItem(DISMISS_KEY) === '1')
const shown = computed(() =>
  Boolean(session.me) && Boolean(route.meta.auth) && pins.global.length > 0 && !dismissed.value)

function go(item) {
  const tab = item.targetType === 'care' && item.category === 'period' ? 'period' : item.targetType
  router.push({ path: '/notebook', query: { tab } })
}

function dismiss() {
  dismissed.value = true
  sessionStorage.setItem(DISMISS_KEY, '1')
}
</script>

<template>
  <div v-if="shown" class="pinned-banner sticky top-0 z-40">
    <div class="mx-auto flex max-w-3xl items-center gap-1.5 px-3 py-1">
      <span class="shrink-0 text-sm leading-none">📌</span>
      <div class="pinned-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        <button v-for="item in pins.global" :key="item.targetType + item.targetId"
          class="max-w-[11rem] shrink-0 truncate rounded-full border px-2.5 py-1 text-xs leading-none transition-colors"
          :class="item.type === 'redline' ? 'danger-link border-current' : 'border-accent text-accent'"
          @click="go(item)">
          {{ item.title }}
        </button>
      </div>
      <button class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base text-theme-tertiary transition-colors hover:bg-white/10 hover:text-theme-primary"
        aria-label="关闭置顶横幅" @click="dismiss">×</button>
    </div>
  </div>
</template>

<style scoped>
.pinned-banner {
  border-radius: 0;
  border-bottom: 1px solid rgb(var(--border-subtle-rgb) / 0.18);
  background: rgb(var(--page-bg-rgb) / 0.82);
  backdrop-filter: blur(12px) saturate(1.2);
}

.pinned-scroll {
  scrollbar-width: none;
}

.pinned-scroll::-webkit-scrollbar {
  display: none;
}
</style>
