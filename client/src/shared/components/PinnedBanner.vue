<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session } from '../../stores/session'
import { pins } from '../../stores/pins'

// 全站置顶：顶部悬浮胶囊，点开看全部；会话内可关闭
const route = useRoute()
const router = useRouter()
const DISMISS_KEY = 'resonance.pins.dismissed'

const dismissed = ref(sessionStorage.getItem(DISMISS_KEY) === '1')
const expanded = ref(false)

const shown = computed(() =>
  Boolean(session.me) && Boolean(route.meta.auth) && pins.global.length > 0 && !dismissed.value)
const first = computed(() => pins.global[0] || null)
const restCount = computed(() => Math.max(0, pins.global.length - 1))

const CARE_LABELS = { diet: '忌口', allergy: '过敏', period: '例假', preference: '偏好', other: '其他' }
const RULE_LABELS = { redline: '底线', rule: '约定', suggestion: '建议' }

function badgeOf(item) {
  if (item.targetType === 'rule') {
    return { text: RULE_LABELS[item.type] || '规矩', danger: item.type === 'redline' }
  }
  return { text: CARE_LABELS[item.category] || '档案', danger: false }
}

function go(item) {
  expanded.value = false
  const tab = item.targetType === 'care' && item.category === 'period' ? 'period' : item.targetType
  router.push({ path: '/notebook', query: { tab } })
}

function openNotebook() {
  expanded.value = false
  router.push('/notebook')
}

function dismiss() {
  dismissed.value = true
  expanded.value = false
  sessionStorage.setItem(DISMISS_KEY, '1')
}

watch(() => route.fullPath, () => { expanded.value = false })
</script>

<template>
  <div v-if="shown" class="pointer-events-none sticky top-0 z-40 flex justify-center px-3 py-2">
    <div class="pointer-events-auto relative">
      <button class="pin-pill flex min-h-10 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full px-4 text-xs"
        title="全站置顶" :aria-expanded="expanded" @click="expanded = !expanded">
        <span class="shrink-0 leading-none">📌</span>
        <span class="min-w-0 flex-1 truncate">{{ first?.title }}</span>
        <span v-if="restCount" class="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
          +{{ restCount }}
        </span>
        <span class="shrink-0 text-[10px] text-theme-tertiary transition-transform" :class="expanded ? 'rotate-180' : ''">▾</span>
      </button>

      <Transition name="pin-panel">
        <div v-if="expanded"
          class="pin-panel absolute top-[calc(100%+8px)] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl">
          <div class="max-h-[min(60vh,22rem)] overflow-y-auto p-1.5">
            <button v-for="item in pins.global" :key="item.targetType + item.targetId"
              class="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left transition-colors hover:bg-white/10"
              @click="go(item)">
              <span class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                :class="badgeOf(item).danger ? 'danger-link bg-accent-soft' : 'bg-accent-soft text-accent'">
                {{ badgeOf(item).text }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm text-theme-primary">{{ item.title }}</span>
            </button>
          </div>
          <div class="border-theme flex items-center justify-between border-t px-3 py-2">
            <button class="min-h-9 text-xs text-theme-tertiary transition-colors hover:text-theme-primary" @click="dismiss">
              本次不再提示
            </button>
            <button class="min-h-9 text-xs text-accent" @click="openNotebook">去小本本 →</button>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="expanded" class="pointer-events-auto fixed inset-0 -z-10" @click="expanded = false" />
  </div>
</template>

<style scoped>
.pin-pill {
  border: 1px solid rgb(var(--border-subtle-rgb) / 0.22);
  background: rgb(var(--page-bg-rgb) / 0.86);
  color: var(--text-primary);
  box-shadow: 0 6px 20px rgb(var(--shadow-rgb) / 0.28);
  backdrop-filter: blur(12px) saturate(1.2);
  transition: transform 0.15s ease;
}

.pin-pill:active {
  transform: scale(0.98);
}

.pin-panel {
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid rgb(var(--border-subtle-rgb) / 0.22);
  background: rgb(var(--surface-2-rgb) / 0.97);
  box-shadow: 0 16px 40px rgb(var(--shadow-rgb) / 0.35);
  backdrop-filter: blur(16px) saturate(1.2);
}

.pin-panel-enter-active,
.pin-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.pin-panel-enter-from,
.pin-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}

@media (prefers-reduced-motion: reduce) {
  .pin-panel-enter-active,
  .pin-panel-leave-active,
  .pin-pill {
    transition: none;
  }
}
</style>
