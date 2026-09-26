<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listRules } from '../rule.api.js'
import { useInfiniteScroll } from '../../../composables/useInfiniteScroll'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { markContentRead } from '../../../stores/contentUnread'
import PinMenu from '../../../shared/components/PinMenu.vue'
import SuggestionCard from '../../suggestion/components/SuggestionCard.vue'
import UnreadDot from '../../../shared/components/UnreadDot.vue'

// 相处规矩列表：只读预览 + 查看 / 编辑 / 认同 三个入口（列表内不做修改，避免误触）
const router = useRouter()
const PAGE = 20
const PREVIEW = 3

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

// AI 建议「去处理」：跳到对应规矩详情
function onSuggestionOpen(ref) {
  if (ref?.id) router.push(`/notebook/rule/${ref.id}`)
}

const previewItems = (rule) => (rule.items || []).slice(0, PREVIEW)
const moreCount = (rule) => Math.max(0, (rule.items?.length || 0) - PREVIEW)

function progressOf(rule) {
  const active = rule.itemStats?.active || 0
  return active ? Math.round(((rule.itemStats?.effective || 0) / active) * 100) : 0
}

function pendingMine(rule) {
  return (rule.items || []).filter(
    (it) => it.state !== 'archived' && !it.agreedIds?.includes(session.userId),
  ).length
}

function pendingTheirs(rule) {
  const partnerId = session.partner?.id
  if (!partnerId) return 0
  return (rule.items || []).filter(
    (it) => it.state !== 'archived' && !it.agreedIds?.includes(partnerId),
  ).length
}

function statusText(rule) {
  if (rule.effective) return '已生效'
  const mine = pendingMine(rule)
  if (mine > 0) return `待你认同 ${mine} 条`
  const theirs = pendingTheirs(rule)
  if (theirs > 0) return `待 Ta 认同 ${theirs} 条`
  return rule.itemStats?.active ? '已生效' : '暂无条目'
}

// 预览条目的状态点：实心=双方已认同，空心=待我认同，灰点=我已认同待 Ta / 已停用
function itemDot(item) {
  if (item.state === 'archived') return 'bg-white/20'
  if (item.effective) return 'bg-accent'
  return item.agreedIds?.includes(session.userId) ? 'bg-white/30' : 'border border-accent-2'
}

function itemDotTitle(item) {
  if (item.state === 'archived') return '已停用'
  if (item.effective) return '已生效'
  return item.agreedIds?.includes(session.userId) ? '待 Ta 认同' : '待你认同'
}

onMounted(() => {
  // 先取数据（保留未读标记），再标记本模块已读
  load(true).then(() => markContentRead('rule'))
})
defineExpose({ load })
</script>

<template>
  <div class="space-y-4">
    <SuggestionCard target="rule" @open="onSuggestionOpen" />

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
              <UnreadDot :show="Boolean(rule.is_unread)" label="新" />
              <h3 class="font-medium">{{ rule.title }}</h3>
              <span v-if="rule.itemStats?.total" class="rounded-full surface-soft px-2 py-0.5 text-[11px] text-theme-tertiary">
                {{ rule.itemStats.total }} 条<template v-if="rule.itemStats.archived"> · {{ rule.itemStats.archived }} 条已停用</template>
              </span>
              <span v-if="rule.pin_scope" class="text-xs text-accent" title="已置顶">📌</span>
            </div>
            <p class="mt-1.5 text-xs text-theme-tertiary">
              {{ rule.author?.nickname || '我' }} 提出 ·
              <span :class="rule.effective ? 'text-accent' : ''">{{ statusText(rule) }}</span>
            </p>
          </div>
          <button class="min-h-11 min-w-11 shrink-0 transition-colors"
            :class="pinTarget?.id === rule.id ? 'text-accent' : 'text-theme-secondary hover:text-accent'"
            title="设置置顶" @click="togglePin(rule)">📌</button>
        </div>

        <!-- 认同进度：一眼看出还有几条没生效 -->
        <div v-if="rule.itemStats?.active" class="mt-2 flex items-center gap-2">
          <div class="surface-soft h-1 flex-1 overflow-hidden rounded-full">
            <div class="progress-fill h-full rounded-full transition-all duration-500" :style="{ width: `${progressOf(rule)}%` }" />
          </div>
          <span class="shrink-0 text-[10px] tabular-nums text-theme-tertiary">
            已生效 {{ rule.itemStats.effective }}/{{ rule.itemStats.active }}
          </span>
        </div>

        <!-- 只读预览：点一下进查看页 -->
        <div v-if="rule.items?.length" class="mt-3 cursor-pointer" title="查看全部条目"
          @click="router.push(`/notebook/rule/${rule.id}`)">
          <ol class="space-y-1">
            <li v-for="(item, i) in previewItems(rule)" :key="item.id" class="flex items-start gap-2 text-sm">
              <span class="w-6 shrink-0 text-right text-[11px] tabular-nums leading-6 text-theme-tertiary">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" :class="itemDot(item)" :title="itemDotTitle(item)" />
              <span class="min-w-0 flex-1 break-words leading-6"
                :class="item.state === 'archived' ? 'text-theme-tertiary line-through opacity-60' : 'text-theme-secondary'">{{ item.text }}</span>
              <span v-if="item.state === 'archived'" class="shrink-0 text-[11px] leading-6 text-theme-tertiary">已停用</span>
            </li>
          </ol>
          <p v-if="moreCount(rule)" class="mt-1.5 pl-8 text-xs text-theme-tertiary">还有 {{ moreCount(rule) }} 条，点「查看」</p>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button class="btn-ghost !min-h-9 !px-3 text-xs" @click="router.push(`/notebook/rule/${rule.id}`)">查看</button>
          <button class="btn-ghost !min-h-9 !px-3 text-xs" @click="router.push(`/notebook/rule/${rule.id}/edit`)">编辑</button>
          <button v-if="pendingMine(rule) && rule.status === 'active'" class="btn-primary !min-h-9 !px-3 text-xs"
            @click="router.push(`/notebook/rule/${rule.id}/agree`)">
            认同 · {{ pendingMine(rule) }}
          </button>
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
