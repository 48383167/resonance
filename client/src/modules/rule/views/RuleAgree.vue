<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import anime from 'animejs'
import { getRule, agreeRule, agreeRuleItem } from '../rule.api.js'
import { socket } from '../../../socket'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'

// 规矩认同页：逐条审阅、逐条表态；认同后该条立即生效
const route = useRoute()
const router = useRouter()
const rule = ref(null)
const loading = ref(true)
const busy = ref(false)
const justAgreedId = ref(null)
const celebrateRef = ref(null)

const TYPE_LABELS = { redline: '底线', rule: '约定', suggestion: '建议' }
const TYPE_CLASSES = {
  redline: 'danger-link bg-accent-soft',
  rule: 'bg-accent-soft text-accent',
  suggestion: 'surface-soft text-theme-secondary',
}

const activeItems = computed(() => (rule.value?.items || []).filter((it) => it.state !== 'archived'))
const archivedCount = computed(() => (rule.value?.items || []).length - activeItems.value.length)
const minePending = computed(() => activeItems.value.filter((it) => !it.agreedIds?.includes(session.userId)))
const mineAgreed = computed(() => activeItems.value.filter((it) => it.agreedIds?.includes(session.userId)))
const effectiveCount = computed(() => activeItems.value.filter((it) => it.effective).length)
const progress = computed(() =>
  activeItems.value.length ? Math.round((effectiveCount.value / activeItems.value.length) * 100) : 0)
const allEffective = computed(() =>
  activeItems.value.length > 0 && effectiveCount.value === activeItems.value.length)
const celebrating = computed(() => allEffective.value && rule.value?.status === 'active')
const doneMine = computed(() => activeItems.value.length > 0 && minePending.value.length === 0)

// 全部生效时的完成态动画
watch(celebrating, async (value) => {
  if (!value) return
  await nextTick()
  if (celebrateRef.value) {
    anime({ targets: celebrateRef.value, scale: [0.92, 1], opacity: [0, 1], duration: 480, easing: 'easeOutBack' })
  }
})

const short = (text) => `${text.slice(0, 14)}${text.length > 14 ? '…' : ''}`

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

function onRuleUpdated(payload) {
  if (payload?.id === route.params.id) rule.value = payload
}
function onRuleDeleted(payload) {
  if (payload?.id === route.params.id) {
    toast('这条规矩已被删除')
    goBack()
  }
}

async function agreeOne(item) {
  if (busy.value) return
  busy.value = true
  try {
    rule.value = await agreeRuleItem(rule.value.id, item.id)
    justAgreedId.value = item.id
    toast('已认同 ❤️')
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}

async function withdrawOne(item) {
  if (busy.value) return
  const ok = await confirmDialog({ title: '撤回认同', message: `确定撤回「${short(item.text)}」的认同吗？撤回后该条不再生效。` })
  if (!ok) return
  busy.value = true
  try {
    rule.value = await agreeRuleItem(rule.value.id, item.id)
    toast('已撤回认同')
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}

async function agreeAll() {
  if (busy.value || !minePending.value.length) return
  busy.value = true
  const count = minePending.value.length
  try {
    rule.value = await agreeRule(rule.value.id)
    toast(`已认同全部 ${count} 条 ❤️`)
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
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
      </div>
      <p class="mt-1 text-sm text-theme-secondary">一条一条看，认同后才会生效</p>

      <div class="glass mt-4 p-4">
        <div class="mb-2 flex items-center justify-between text-xs text-theme-secondary">
          <span>{{ allEffective ? '全部都生效了' : `已生效 ${effectiveCount}/${activeItems.length} 条` }}</span>
          <span class="text-theme-tertiary">{{ progress }}%</span>
        </div>
        <div class="surface-soft h-1.5 overflow-hidden rounded-full">
          <div class="progress-fill h-full rounded-full transition-all duration-500" :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <div v-if="celebrating" ref="celebrateRef"
        class="mt-4 rounded-2xl bg-accent-soft px-4 py-5 text-center text-accent">
        <div class="text-2xl">❤️</div>
        <p class="mt-1 text-sm">都认同了，这条规矩正式生效</p>
      </div>
      <div v-else-if="rule.status === 'archived'"
        class="mt-4 rounded-2xl surface-soft px-4 py-4 text-center text-sm text-theme-secondary">
        这条规矩已停用，认同不会改变整体状态
      </div>
      <div v-else-if="doneMine" class="mt-4 rounded-2xl surface-soft px-4 py-4 text-center text-sm text-theme-secondary">
        你已全部认同，等 Ta 回应
      </div>

      <template v-if="activeItems.length">
        <section v-if="minePending.length" class="mt-5">
          <p class="mb-2 text-xs text-theme-tertiary">待你认同 · {{ minePending.length }} 条</p>
          <TransitionGroup name="agree" tag="div" class="space-y-2">
            <div v-for="item in minePending" :key="item.id" class="glass flex items-center gap-3 p-3.5">
              <span class="min-w-0 flex-1 break-words text-sm leading-6 text-theme-secondary">{{ item.text }}</span>
              <button class="btn-primary !min-h-10 shrink-0 !px-4 text-sm" :disabled="busy" @click="agreeOne(item)">认同</button>
            </div>
          </TransitionGroup>
        </section>

        <section v-if="mineAgreed.length" class="mt-5">
          <p class="mb-2 text-xs text-theme-tertiary">我已认同 · {{ mineAgreed.length }} 条</p>
          <TransitionGroup name="agree" tag="div" class="space-y-1.5">
            <div v-for="item in mineAgreed" :key="item.id" class="flex items-center gap-2.5 px-1.5 py-1">
              <span class="inline-block shrink-0 text-sm text-accent" :class="{ 'agree-pop': item.id === justAgreedId }">✓</span>
              <span class="min-w-0 flex-1 truncate text-sm text-theme-secondary">{{ item.text }}</span>
              <span v-if="item.effective" class="shrink-0 text-xs text-accent">已生效</span>
              <button class="min-h-9 shrink-0 px-2 text-xs text-theme-tertiary transition-colors hover:text-accent"
                :disabled="busy" @click="withdrawOne(item)">撤回</button>
            </div>
          </TransitionGroup>
        </section>

        <p v-if="archivedCount" class="mt-4 text-xs text-theme-tertiary">另有 {{ archivedCount }} 条已停用，不需要认同</p>
      </template>
      <p v-else class="glass mt-5 p-6 text-center text-sm text-theme-tertiary">这条规矩还没有条目</p>

      <div class="mt-5">
        <button v-if="minePending.length" class="btn-primary w-full" :disabled="busy" @click="agreeAll">
          一键认同全部（{{ minePending.length }} 条）
        </button>
        <button v-else class="btn-ghost w-full" @click="goBack">完成</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.agree-enter-active,
.agree-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.agree-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.agree-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
.agree-move {
  transition: transform 0.22s ease;
}

.agree-pop {
  animation: agree-pop 0.36s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes agree-pop {
  from { transform: scale(0.3); }
  to { transform: scale(1); }
}
</style>
