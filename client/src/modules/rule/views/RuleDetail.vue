<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import anime from 'animejs'
import { getRule } from '../rule.api.js'
import { socket } from '../../../socket'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'

// 规矩查看页：纯展示，逐条状态一目了然；修改/认同去专门页面
const route = useRoute()
const router = useRouter()
const rule = ref(null)
const loading = ref(true)
const celebrateRef = ref(null)

const TYPE_LABELS = { redline: '底线', rule: '约定', suggestion: '建议' }
const TYPE_CLASSES = {
  redline: 'danger-link bg-accent-soft',
  rule: 'bg-accent-soft text-accent',
  suggestion: 'surface-soft text-theme-secondary',
}

const activeItems = computed(() => (rule.value?.items || []).filter((it) => it.state !== 'archived'))
const archivedItems = computed(() => (rule.value?.items || []).filter((it) => it.state === 'archived'))
const pendingMine = computed(() =>
  activeItems.value.filter((it) => !it.agreedIds?.includes(session.userId)).length)

// 与认同页保持一致的完成态：全部生效且整条未被停用
const celebrating = computed(() => Boolean(rule.value?.effective) && rule.value?.status === 'active')
watch(celebrating, async (value) => {
  if (!value) return
  await nextTick()
  if (celebrateRef.value) {
    anime({ targets: celebrateRef.value, scale: [0.94, 1], opacity: [0, 1], duration: 460, easing: 'easeOutBack' })
  }
})

const effectiveCount = computed(() => rule.value?.itemStats?.effective || 0)
const pendingCount = computed(() => Math.max(0, activeItems.value.length - effectiveCount.value))
const progress = computed(() =>
  activeItems.value.length ? Math.round((effectiveCount.value / activeItems.value.length) * 100) : 0)

function itemStatus(item) {
  if (item.state === 'archived') return { text: '已停用', icon: '—', class: 'surface-soft text-theme-tertiary' }
  if (item.effective) return { text: '已生效', icon: '✓', class: 'bg-accent-soft text-accent' }
  if (item.agreedIds?.includes(session.userId)) return { text: '待 Ta 认同', icon: '⋯', class: 'surface-soft text-theme-tertiary' }
  return { text: '待你认同', icon: '○', class: 'border border-accent-2 text-accent' }
}

// 我还没认同的条目：整行轻微提亮，方便一眼找到要处理的
function needsMe(item) {
  return item.state !== 'archived' && !item.effective && !item.agreedIds?.includes(session.userId)
}

function agreedNames(item) {
  const names = []
  if (item.agreedIds?.includes(session.userId)) names.push('我')
  if (session.partner?.id && item.agreedIds?.includes(session.partner.id)) names.push(session.partner.nickname || 'Ta')
  return names.join('、')
}

function dateText(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push({ path: '/notebook', query: { tab: 'rule' } })
}

async function load() {
  try {
    rule.value = await getRule(route.params.id)
  } catch (e) {
    toast(e.message)
    goBack()
  } finally {
    loading.value = false
  }
}

// 对方改动/认同后实时刷新；被删除则退出
function onRuleUpdated(payload) {
  if (payload?.id === route.params.id) rule.value = payload
}
function onRuleDeleted(payload) {
  if (payload?.id === route.params.id) {
    toast('这条规矩已被删除')
    goBack()
  }
}

onMounted(() => {
  load()
  socket.on('rule:updated', onRuleUpdated)
  socket.on('rule:deleted', onRuleDeleted)
})
onUnmounted(() => {
  socket.off('rule:updated', onRuleUpdated)
  socket.off('rule:deleted', onRuleDeleted)
})
</script>

<template>
  <div class="fade-up">
    <button class="btn-ghost mb-4 text-sm" @click="goBack">← 返回</button>

    <div v-if="loading" class="py-10 text-center text-sm text-theme-tertiary">加载中…</div>

    <template v-else-if="rule">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full px-2 py-1 text-xs" :class="TYPE_CLASSES[rule.type]">{{ TYPE_LABELS[rule.type] }}</span>
        <h1 class="serif text-xl">{{ rule.title }}</h1>
        <span v-if="rule.pin_scope" class="text-xs text-accent" title="已置顶">📌</span>
      </div>

      <p class="mt-2 text-xs text-theme-tertiary">
        {{ rule.author?.nickname || '我' }} 提出 · {{ dateText(rule.created_at) }}
        <template v-if="rule.itemStats?.archived"> · {{ rule.itemStats.archived }} 条已停用</template>
      </p>

      <div v-if="celebrating" ref="celebrateRef"
        class="mt-3 rounded-2xl bg-accent-soft px-4 py-4 text-center text-accent">
        <div class="text-xl">❤️</div>
        <p class="mt-1 text-sm">都认同了，这条规矩正式生效</p>
      </div>

      <div v-else-if="activeItems.length" class="glass mt-3 rounded-2xl px-4 py-3">
        <div class="flex items-center justify-between text-xs">
          <span class="text-theme-secondary">
            已生效 <span class="font-medium text-accent">{{ effectiveCount }}</span><span class="text-theme-tertiary">/{{ activeItems.length }} 条</span>
          </span>
          <span class="flex items-center gap-2">
            <span v-if="rule.status === 'archived'" class="surface-soft rounded-full px-2 py-0.5 text-theme-tertiary">整条已停用</span>
            <span class="tabular-nums text-theme-tertiary">{{ progress }}%</span>
          </span>
        </div>
        <div class="surface-soft mt-2 h-1.5 overflow-hidden rounded-full">
          <div class="progress-fill h-full rounded-full transition-all duration-500" :style="{ width: `${progress}%` }" />
        </div>
        <p v-if="pendingCount" class="mt-1.5 text-[11px] text-theme-tertiary">还有 {{ pendingCount }} 条待认同</p>
      </div>

      <div class="glass mt-4 p-4">
        <ol v-if="activeItems.length" class="space-y-1">
          <li v-for="(item, i) in activeItems" :key="item.id"
            class="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors"
            :class="needsMe(item) ? 'bg-accent-soft' : ''">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums"
              :class="item.effective ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-tertiary'">
              {{ String(i + 1).padStart(2, '0') }}
            </span>
            <span class="min-w-0 flex-1 break-words text-sm leading-6"
              :class="needsMe(item) ? 'text-theme-primary' : 'text-theme-secondary'">{{ item.text }}</span>
            <span class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              :class="itemStatus(item).class" :title="agreedNames(item)">
              <span>{{ itemStatus(item).icon }}</span>
              <span>{{ itemStatus(item).text }}</span>
            </span>
          </li>
        </ol>
        <p v-else class="py-4 text-center text-sm text-theme-tertiary">这条规矩还没有条目</p>

        <div v-if="archivedItems.length" class="mt-4 border-t border-white/5 pt-3">
          <p class="mb-2 text-xs text-theme-tertiary">已停用 · {{ archivedItems.length }} 条</p>
          <ul class="space-y-1">
            <li v-for="item in archivedItems" :key="item.id"
              class="flex items-start gap-3 rounded-xl px-2 py-1.5 text-sm opacity-60">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full surface-soft text-[11px] text-theme-tertiary">—</span>
              <span class="min-w-0 flex-1 break-words leading-6 text-theme-tertiary line-through">{{ item.text }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <button class="btn-ghost w-full sm:w-auto" @click="router.push(`/notebook/rule/${rule.id}/edit`)">编辑</button>
        <button v-if="pendingMine" class="btn-primary w-full sm:w-auto" @click="router.push(`/notebook/rule/${rule.id}/agree`)">
          去认同（{{ pendingMine }} 条）
        </button>
      </div>
    </template>
  </div>
</template>
