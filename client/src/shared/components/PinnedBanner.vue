<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session } from '../../stores/session'
import { pins } from '../../stores/pins'

// 全站置顶细横幅：吸顶单行，可展开，会话内可关闭
const route = useRoute()
const router = useRouter()
const DISMISS_KEY = 'resonance.pins.dismissed'
const MAX_COLLAPSED = 5

const dismissed = ref(sessionStorage.getItem(DISMISS_KEY) === '1')
const expanded = ref(false)

const shown = computed(() =>
  Boolean(session.me) && Boolean(route.meta.auth) && pins.global.length > 0 && !dismissed.value)
const visible = computed(() => (expanded.value ? pins.global : pins.global.slice(0, MAX_COLLAPSED)))
const hiddenCount = computed(() => Math.max(0, pins.global.length - MAX_COLLAPSED))

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
  <div v-if="shown" class="pinned-banner glass sticky top-0 z-40 px-3 py-1.5">
    <div class="mx-auto flex min-h-8 max-w-3xl items-center gap-2">
      <span class="shrink-0">📌</span>
      <div class="flex min-w-0 flex-1 flex-wrap gap-1.5" :class="expanded ? 'max-h-28 overflow-y-auto' : 'overflow-hidden'">
        <button v-for="item in visible" :key="item.targetType + item.targetId"
          class="max-w-40 truncate rounded-full border px-2.5 py-1 text-xs transition-colors"
          :class="item.type === 'redline' ? 'danger-link border-current' : 'border-accent text-accent'"
          @click="go(item)">
          {{ item.title }}
        </button>
        <span v-if="!expanded && hiddenCount" class="self-center text-xs text-theme-tertiary">
          还有 {{ hiddenCount }} 条
        </span>
      </div>
      <button v-if="hiddenCount" class="min-h-11 shrink-0 text-xs text-theme-secondary"
        @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开' }}
      </button>
      <button class="min-h-11 shrink-0 px-1 text-lg text-theme-tertiary" aria-label="关闭置顶横幅" @click="dismiss">×</button>
    </div>
  </div>
</template>

<style scoped>
.pinned-banner { border-radius: 0; }
</style>
