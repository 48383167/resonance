<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listCareItems, removeCareItem } from '../care.api.js'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import CareItemRow from './CareItemRow.vue'
import SuggestionCard from '../../suggestion/components/SuggestionCard.vue'

// 关怀档案列表：安全速查（搜索 / 能不能吃 / 复制清单）+ 分类卡行式条目 + 分类内折叠
const router = useRouter()
const items = ref([])
const category = ref('')
const subjectId = ref('')
const keyword = ref('')
const pinTarget = ref(null)
const expanded = ref(new Set())

const COLLAPSE_LIMIT = 4

const CATEGORIES = [
  { value: 'diet', label: '🍽️ 忌口' },
  { value: 'allergy', label: '⚠️ 过敏' },
  { value: 'preference', label: '💗 偏好' },
  { value: 'other', label: '📎 其他' },
]
const CATEGORY_LABELS = { diet: '忌口', allergy: '过敏', preference: '偏好', other: '其他' }
const SEVERITY_LABELS = { mild: '轻度', moderate: '中度', severe: '重度' }
const SEVERITY_RANK = { severe: 0, moderate: 1, mild: 2 }
const PRIORITY = { allergy: 0, diet: 1, preference: 2, other: 3 }

const subjectOptions = computed(() => {
  const options = [{ value: '', label: '全部' }, { value: session.userId, label: '我' }]
  if (session.partner) options.push({ value: session.partner.id, label: 'Ta' })
  return options
})

const searching = computed(() => Boolean(keyword.value.trim()))
const filtering = computed(() => Boolean(category.value || subjectId.value))

const subjectFiltered = (list) =>
  list.filter((item) => !subjectId.value || item.subject_id === subjectId.value)

const groups = computed(() => CATEGORIES
  .filter((c) => !category.value || c.value === category.value)
  .map((c) => ({
    ...c,
    items: subjectFiltered(items.value).filter((item) => item.category === c.value),
  }))
  .filter((g) => g.items.length))

// —— 速查：命中排序 过敏(重→轻) > 忌口 > 偏好 > 其他 ——
const matches = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return []
  return subjectFiltered(items.value).filter((item) =>
    String(item.title || '').toLowerCase().includes(k)
    || String(item.content || '').toLowerCase().includes(k))
})

const sortedMatches = computed(() => [...matches.value].sort((a, b) =>
  (PRIORITY[a.category] ?? 9) - (PRIORITY[b.category] ?? 9)
  || (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)))

function subjectWord(item) {
  if (item.subject_id === session.userId) return '你'
  return item.subject?.nickname || 'Ta'
}

// 结论卡：过敏 > 忌口 > 其他命中 > 无记录
const conclusion = computed(() => {
  if (!searching.value) return null
  const list = sortedMatches.value
  const allergy = list.filter((i) => i.category === 'allergy')
  if (allergy.length) {
    const worst = allergy[0]
    const level = SEVERITY_LABELS[worst.severity] || ''
    return {
      tone: 'danger',
      title: `${subjectWord(worst)}对「${worst.title}」${level ? `${level}过敏` : '过敏'}，别吃！`,
      detail: worst.content || '',
    }
  }
  const diet = list.filter((i) => i.category === 'diet')
  if (diet.length) {
    const first = diet[0]
    return { tone: 'warn', title: `${subjectWord(first)}忌口里有「${first.title}」`, detail: first.content || '' }
  }
  if (list.length) {
    const first = list[0]
    return {
      tone: 'soft',
      title: `档案里有「${first.title}」（${CATEGORY_LABELS[first.category]}）`,
      detail: first.content || '',
    }
  }
  return { tone: 'safe', title: `档案里没有「${keyword.value.trim()}」，可以放心`, detail: '' }
})

const CONCLUSION_CLASSES = {
  danger: 'danger-link border-current',
  warn: 'text-accent border-accent bg-accent-soft',
  soft: 'surface-soft text-theme-secondary border-transparent',
  safe: 'surface-soft text-theme-secondary border-transparent',
}

// 同名词同时记在多个分类：行内提示，避免重复/冲突
const titleIndex = computed(() => {
  const map = new Map()
  for (const item of items.value) {
    const key = String(item.title || '').trim().toLowerCase()
    if (!key) continue
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(item.category)
  }
  return map
})

function crossLabelOf(item) {
  const cats = titleIndex.value.get(String(item.title || '').trim().toLowerCase())
  if (!cats || cats.size < 2) return ''
  const others = [...cats].filter((c) => c !== item.category).map((c) => CATEGORY_LABELS[c] || c)
  return `也记在${others.join('、')}`
}

function visibleItems(group) {
  if (filtering.value || expanded.value.has(group.value)) return group.items
  return group.items.slice(0, COLLAPSE_LIMIT)
}

function hiddenCount(group) {
  if (filtering.value) return 0
  return Math.max(0, group.items.length - COLLAPSE_LIMIT)
}

function toggleExpand(value) {
  const next = new Set(expanded.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  expanded.value = next
}

function toggleExpandTo(value, expand) {
  const next = new Set(expanded.value)
  if (expand) next.add(value)
  else next.delete(value)
  expanded.value = next
}

// —— 置顶速览：点一下展开所属分类并滚到该条 ——
const pinnedItems = computed(() => items.value.filter((item) => item.pin_scope))

async function jumpTo(item) {
  keyword.value = ''
  if (subjectId.value && item.subject_id !== subjectId.value) subjectId.value = ''
  toggleExpandTo(item.category, true)
  await nextTick()
  document.getElementById(`care-item-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// AI 建议「去处理」：展开并定位到对应档案
function onSuggestionOpen(ref) {
  const item = items.value.find((i) => i.id === ref?.id)
  if (item) jumpTo(item)
}

// —— 随机关怀回顾：重度过敏不参与，避免添堵 ——
const randomItem = ref(null)
function randomSentence(item) {
  const who = subjectWord(item)
  if (item.category === 'preference') return `${who}喜欢「${item.title}」`
  if (item.category === 'diet') return `${who}不爱吃「${item.title}」`
  if (item.category === 'allergy') return `${who}对「${item.title}」过敏`
  return `${who}的小事：「${item.title}」`
}

function randomEmoji(item) {
  return { preference: '💗', diet: '🍽️', allergy: '⚠️', other: '📎' }[item.category] || '💭'
}

function pickRandom() {
  const pool = subjectFiltered(items.value)
    .filter((i) => !(i.category === 'allergy' && i.severity === 'severe'))
  if (!pool.length) {
    randomItem.value = null
    return
  }
  let next = pool[Math.floor(Math.random() * pool.length)]
  let guard = 0
  while (pool.length > 1 && randomItem.value && next.id === randomItem.value.id && guard++ < 8) {
    next = pool[Math.floor(Math.random() * pool.length)]
  }
  randomItem.value = { ...next }
}

function togglePin(item) {
  pinTarget.value = pinTarget.value?.id === item.id ? null : item
}

async function load() {
  try {
    items.value = await listCareItems()
    if (!randomItem.value || !items.value.some((i) => i.id === randomItem.value.id)) pickRandom()
  } catch (e) {
    toast(e.message)
  }
}

async function remove(item) {
  const ok = await confirmDialog({ title: '删除档案', message: `确定删除「${item.title}」吗？` })
  if (!ok) return
  try {
    await removeCareItem(item.id)
    await load()
    toast('档案已删除')
  } catch (e) {
    toast(e.message)
  }
}

// —— 复制：清单一键发餐厅 / 结论一键发朋友 ——
async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text)
    toast(okMessage)
  } catch {
    toast('复制失败，请手动选择文本')
  }
}

function dietListText() {
  const list = subjectFiltered(items.value).filter((i) => !category.value || i.category === category.value)
  const byCat = { allergy: [], diet: [], preference: [], other: [] }
  for (const item of list) byCat[item.category]?.push(item)
  const subjectLabel = subjectOptions.value.find((o) => o.value === subjectId.value)?.label
  const lines = [subjectId.value ? `【${subjectLabel}的饮食注意】` : '【饮食注意】']
  if (byCat.allergy.length) {
    lines.push(`⚠️ 过敏：${byCat.allergy.map((i) => `${i.title}${i.severity ? `（${SEVERITY_LABELS[i.severity]}）` : ''}`).join('、')}`)
  }
  if (byCat.diet.length) lines.push(`🍽️ 忌口：${byCat.diet.map((i) => i.title).join('、')}`)
  if (byCat.preference.length) lines.push(`💗 偏好：${byCat.preference.map((i) => i.title).join('、')}`)
  if (byCat.other.length) lines.push(`📎 其他：${byCat.other.map((i) => i.title).join('、')}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

async function copyList() {
  const text = dietListText()
  if (!text) return toast('还没有可复制的档案')
  await copyText(text, '已复制，可以发给餐厅啦')
}

async function copyConclusion() {
  if (!conclusion.value) return
  const text = `【饮食注意】${conclusion.value.title}${conclusion.value.detail ? `\n${conclusion.value.detail}` : ''}`
  await copyText(text, '已复制结论')
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="space-y-4">
    <!-- 分类筛选 -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button v-for="c in [{ value: '', label: '全部' }, ...CATEGORIES]" :key="c.value"
        class="min-h-11 shrink-0 rounded-full px-3 text-sm transition-colors"
        :class="category === c.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
        @click="category = c.value">
        {{ c.label }}
      </button>
    </div>

    <!-- 对象筛选 -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button v-for="s in subjectOptions" :key="s.value"
        class="min-h-11 shrink-0 rounded-full px-3 text-sm transition-colors"
        :class="subjectId === s.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
        @click="subjectId = s.value">
        {{ s.label }}
      </button>
    </div>

    <!-- 安全速查 -->
    <div class="flex items-center gap-2">
      <input v-model="keyword" class="input-dark !min-h-11 flex-1 text-sm" maxlength="40"
        placeholder="搜一搜：香菜、花生、牛奶…" />
      <button class="btn-ghost !min-h-11 shrink-0 !px-3 text-xs" title="复制饮食注意清单" @click="copyList">复制清单</button>
    </div>

    <SuggestionCard target="care" @open="onSuggestionOpen" />

    <!-- 置顶速览：点一下展开并定位 -->
    <div v-if="!searching && !filtering && pinnedItems.length" class="flex gap-2 overflow-x-auto pb-1">
      <button v-for="item in pinnedItems" :key="item.id"
        class="surface-soft flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs text-theme-secondary transition-colors hover:text-accent"
        :title="`定位到：${item.title}`" @click="jumpTo(item)">
        <span class="shrink-0">📌</span>
        <span class="max-w-40 truncate">{{ item.title }}</span>
        <span class="shrink-0 text-[10px] text-theme-tertiary">{{ CATEGORY_LABELS[item.category] }}</span>
      </button>
    </div>

    <!-- 速查结果 -->
    <template v-if="searching">
      <div class="rounded-2xl border p-4" :class="CONCLUSION_CLASSES[conclusion.tone]">
        <p class="text-sm font-medium">{{ conclusion.title }}</p>
        <p v-if="conclusion.detail" class="mt-1 whitespace-pre-wrap text-xs opacity-80">{{ conclusion.detail }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="btn-ghost !min-h-9 !px-3 text-xs" @click="copyConclusion">复制结论</button>
          <template v-if="!sortedMatches.length">
            <button class="btn-ghost !min-h-9 !px-3 text-xs"
              @click="router.push({ path: '/notebook/care/new', query: { category: 'diet', title: keyword.trim() } })">记一条忌口</button>
            <button class="btn-ghost !min-h-9 !px-3 text-xs"
              @click="router.push({ path: '/notebook/care/new', query: { category: 'allergy', title: keyword.trim() } })">记一条过敏</button>
          </template>
        </div>
      </div>

      <div v-if="sortedMatches.length" class="glass divide-y divide-white/5 px-3">
        <CareItemRow v-for="item in sortedMatches" :key="item.id" :item="item" :keyword="keyword"
          :pin-open="pinTarget?.id === item.id" :cross-label="crossLabelOf(item)"
          @pin="togglePin(item)" @edit="router.push(`/notebook/care/${item.id}/edit`)" @remove="remove(item)"
          @pin-close="pinTarget = null" @pin-change="load" />
      </div>
      <div v-else class="glass p-6 text-center text-sm text-theme-tertiary">
        没有找到相关记录，可以放心，也可以随手记下来。
      </div>
    </template>

    <!-- 常规分组 -->
    <template v-else>
      <div v-if="groups.length" class="space-y-5">
        <section v-for="group in groups" :key="group.value" class="fade-up">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm text-theme-secondary">{{ group.label }}</h3>
            <span class="text-[11px] text-theme-tertiary">{{ group.items.length }} 条</span>
          </div>

          <div class="glass divide-y divide-white/5 px-3">
            <CareItemRow v-for="item in visibleItems(group)" :key="item.id" :item="item"
              :pin-open="pinTarget?.id === item.id" :cross-label="crossLabelOf(item)"
              @pin="togglePin(item)" @edit="router.push(`/notebook/care/${item.id}/edit`)" @remove="remove(item)"
              @pin-close="pinTarget = null" @pin-change="load" />

            <button v-if="!filtering && group.items.length > COLLAPSE_LIMIT"
              class="flex min-h-10 w-full items-center justify-center gap-1 text-xs text-theme-tertiary transition-colors hover:text-accent"
              @click="toggleExpand(group.value)">
              {{ expanded.has(group.value) ? '收起 ▴' : `展开其余 ${hiddenCount(group)} 条 ▾` }}
            </button>
          </div>
        </section>
      </div>

      <div v-else class="glass p-8 text-center text-sm text-theme-tertiary">
        {{ filtering ? '没有符合筛选的档案，换个条件试试。' : '还没有关怀档案，把那些重要的小事记下来吧。' }}
      </div>
    </template>

    <!-- 随机关怀回顾 -->
    <div v-if="!searching && !filtering && randomItem" class="glass flex items-center gap-3 p-4">
      <span class="text-xl">{{ randomEmoji(randomItem) }}</span>
      <button class="min-w-0 flex-1 text-left" @click="jumpTo(randomItem)">
        <span class="block text-[11px] text-theme-tertiary">今天想起一件小事</span>
        <span class="mt-0.5 block truncate text-sm text-theme-secondary">{{ randomSentence(randomItem) }}</span>
      </button>
      <button class="min-h-9 shrink-0 px-2 text-xs text-theme-tertiary transition-colors hover:text-accent" @click="pickRandom">
        换一条
      </button>
    </div>

    <button class="btn-primary w-full" @click="router.push('/notebook/care/new')">＋ 添加档案</button>
  </div>
</template>
