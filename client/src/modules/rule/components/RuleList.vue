<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listRules, agreeRule, removeRule, updateRule } from '../rule.api.js'
import { useInfiniteScroll } from '../../../composables/useInfiniteScroll'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import PinMenu from '../../../shared/components/PinMenu.vue'

// 相处规矩：底线 / 约定 / 建议；一方提出，另一方认同后生效
// 筛选（类型 / 待我认同 / 已停用）走服务端，列表触底自动加载
const router = useRouter()
const PAGE = 20
const rules = ref([])
const total = ref(0)
const filter = ref('all')
const loading = ref(false)
const loadingMore = ref(false)
const pinTarget = ref(null)

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'redline', label: '底线' },
  { value: 'rule', label: '约定' },
  { value: 'suggestion', label: '建议' },
  { value: 'pending', label: '待我认同' },
  { value: 'archived', label: '已停用' },
]
const TYPE_LABELS = { redline: '底线', rule: '约定', suggestion: '建议' }
const TYPE_CLASSES = {
  redline: 'danger-link bg-accent-soft',
  rule: 'bg-accent-soft text-accent',
  suggestion: 'surface-soft text-theme-secondary',
}

// 筛选 → 服务端查询参数
function queryOf(value) {
  if (value === 'archived') return { status: 'archived' }
  if (value === 'pending') return { status: 'active', pending: 1 }
  if (value === 'all') return { status: 'active' }
  return { status: 'active', type: value }
}

async function load(reset = true) {
  if (reset) {
    loading.value = true
  } else {
    if (loadingMore.value || rules.value.length >= total.value) return
    loadingMore.value = true
  }
  try {
    const offset = reset ? 0 : rules.value.length
    const data = await listRules({ ...queryOf(filter.value), offset, limit: PAGE })
    rules.value = reset ? data.items : [...rules.value, ...data.items]
    total.value = data.total
  } catch (e) {
    toast(e.message)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const { sentinel } = useInfiniteScroll(
  () => load(false),
  () => rules.value.length < total.value,
)

const agreedByMe = (rule) => Boolean(rule.agreedIds?.includes(session.userId))

function statusText(rule) {
  if (rule.effective) return '已生效'
  return rule.author_id === session.userId ? '待 Ta 认同' : '待你认同'
}

function togglePin(rule) {
  pinTarget.value = pinTarget.value?.id === rule.id ? null : rule
}

async function chooseFilter(value) {
  if (filter.value === value) return
  filter.value = value
  rules.value = []
  total.value = 0
  await load(true)
}

async function agree(rule) {
  const wasAgreed = agreedByMe(rule)
  try {
    await agreeRule(rule.id)
    await load(true)
    toast(wasAgreed ? '已撤回认同' : '已认同 ❤️')
  } catch (e) {
    toast(e.message)
  }
}

async function archive(rule) {
  try {
    await updateRule(rule.id, { status: rule.status === 'archived' ? 'active' : 'archived' })
    await load(true)
  } catch (e) {
    toast(e.message)
  }
}

async function remove(rule) {
  const ok = await confirmDialog({ title: '删除规矩', message: `确定删除「${rule.title}」吗？` })
  if (!ok) return
  try {
    await removeRule(rule.id)
    await load(true)
  } catch (e) {
    toast(e.message)
  }
}

onMounted(() => load(true))
defineExpose({ load })
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button v-for="c in FILTERS" :key="c.value"
        class="min-h-11 shrink-0 rounded-full px-3 text-sm transition-colors"
        :class="filter === c.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
        @click="chooseFilter(c.value)">
        {{ c.label }}
      </button>
    </div>

    <div v-if="loading" class="py-10 text-center text-sm text-theme-tertiary">加载中…</div>

    <div v-else-if="rules.length" class="space-y-3">
      <article v-for="rule in rules" :key="rule.id" class="glass fade-up p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full px-2 py-1 text-xs" :class="TYPE_CLASSES[rule.type]">
                {{ TYPE_LABELS[rule.type] }}
              </span>
              <h3 class="font-medium">{{ rule.title }}</h3>
              <span v-if="rule.pin_scope" class="text-xs text-accent" title="已置顶">📌</span>
            </div>
            <p v-if="rule.content" class="mt-2 whitespace-pre-wrap text-sm text-theme-secondary">{{ rule.content }}</p>
            <p class="mt-3 text-xs text-theme-tertiary">
              {{ rule.author?.nickname || '我' }} 提出 ·
              <span :class="rule.effective ? 'text-accent' : 'text-theme-tertiary'">{{ statusText(rule) }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button class="min-h-11 min-w-11 transition-colors"
              :class="pinTarget?.id === rule.id ? 'text-accent' : 'text-theme-secondary hover:text-accent'"
              title="设置置顶" @click="togglePin(rule)">📌</button>
            <button class="min-h-11 px-2 text-xs text-theme-secondary hover:text-theme-primary"
              @click="router.push(`/notebook/rule/${rule.id}/edit`)">编辑</button>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button v-if="!rule.effective && rule.author_id !== session.userId"
            class="btn-ghost !min-h-9 !px-3 text-xs" @click="agree(rule)">
            {{ agreedByMe(rule) ? '已认同（撤回）' : '认同' }}
          </button>
          <button class="btn-ghost !min-h-9 !px-3 text-xs" @click="archive(rule)">
            {{ rule.status === 'archived' ? '恢复' : '停用' }}
          </button>
          <button class="min-h-9 px-3 text-xs danger-link" @click="remove(rule)">删除</button>
        </div>

        <PinMenu v-if="pinTarget?.id === rule.id" target-type="rule" :target-id="rule.id"
          :scope="rule.pin_scope || 'none'" @close="pinTarget = null" @change="load(true)" />
      </article>
    </div>

    <div v-else class="glass p-8 text-center text-sm text-theme-tertiary">
      这里还没有规矩，慢慢商量出属于你们的默契吧。
    </div>

    <div v-if="!loading && rules.length < total" ref="sentinel" class="py-6 text-center text-xs text-theme-tertiary">
      {{ loadingMore ? '加载中…' : '上滑加载更多' }}
    </div>
    <div v-else-if="!loading && rules.length" class="py-6 text-center text-xs text-theme-tertiary opacity-60">已经到底了</div>

    <button class="btn-primary w-full" @click="router.push('/notebook/rule/new')">＋ 添加规矩</button>
  </div>
</template>
