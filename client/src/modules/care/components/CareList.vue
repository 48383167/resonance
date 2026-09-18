<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listCareItems, removeCareItem } from '../care.api.js'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import PinMenu from '../../../shared/components/PinMenu.vue'

// 关怀档案列表：一个分类一张卡、条目成行（一条仍是一条，逐条置顶 / 编辑 / 删除）
// 条目多时分类内折叠，默认露 4 条；筛了分类或对象时全部展开
const router = useRouter()
const items = ref([])
const category = ref('')
const subjectId = ref('')
const pinTarget = ref(null)
const expanded = ref(new Set())

const COLLAPSE_LIMIT = 4

const CATEGORIES = [
  { value: 'diet', label: '🍽️ 忌口' },
  { value: 'allergy', label: '⚠️ 过敏' },
  { value: 'preference', label: '💗 偏好' },
  { value: 'other', label: '📎 其他' },
]
const SEVERITY_LABELS = { mild: '轻度', moderate: '中度', severe: '重度' }

const subjectOptions = computed(() => {
  const options = [{ value: '', label: '全部' }, { value: session.userId, label: '我' }]
  if (session.partner) options.push({ value: session.partner.id, label: 'Ta' })
  return options
})

const groups = computed(() => CATEGORIES
  .filter((c) => !category.value || c.value === category.value)
  .map((c) => ({
    ...c,
    items: items.value.filter((item) =>
      item.category === c.value
      && (!subjectId.value || item.subject_id === subjectId.value)),
  }))
  .filter((g) => g.items.length))

const filtering = computed(() => Boolean(category.value || subjectId.value))

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

function severityClass(severity) {
  if (severity === 'severe') return 'danger-link'
  if (severity === 'moderate') return 'text-accent-2'
  return 'text-theme-tertiary'
}

function subjectText(item) {
  return item.subject?.nickname || (item.subject_id === session.userId ? '我' : 'Ta')
}

function togglePin(item) {
  pinTarget.value = pinTarget.value?.id === item.id ? null : item
}

async function load() {
  try {
    items.value = await listCareItems()
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

    <div v-if="groups.length" class="space-y-5">
      <section v-for="group in groups" :key="group.value" class="fade-up">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm text-theme-secondary">{{ group.label }}</h3>
          <span class="text-[11px] text-theme-tertiary">{{ group.items.length }} 条</span>
        </div>

        <div class="glass divide-y divide-white/5 px-3">
          <div v-for="item in visibleItems(group)" :key="item.id" class="rounded-xl py-2.5"
            :class="item.pin_scope ? '-mx-1.5 bg-accent-soft px-1.5' : ''">
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h4 class="text-sm font-medium">{{ item.title }}</h4>
                  <span v-if="item.severity" class="text-[11px]" :class="severityClass(item.severity)">
                    {{ SEVERITY_LABELS[item.severity] }}
                  </span>
                  <span v-if="item.pin_scope" class="text-[11px] text-accent" title="已置顶">📌</span>
                </div>
                <p v-if="item.content" class="mt-1 whitespace-pre-wrap text-xs leading-5 text-theme-secondary">{{ item.content }}</p>
                <p class="mt-1 text-[11px] text-theme-tertiary">
                  {{ item.author?.nickname || '我' }} 记录 · 关于 {{ subjectText(item) }}
                </p>
              </div>

              <div class="flex shrink-0 items-center">
                <button class="min-h-9 min-w-9 text-xs transition-colors"
                  :class="pinTarget?.id === item.id ? 'text-accent' : 'text-theme-tertiary hover:text-accent'"
                  title="设置置顶" @click="togglePin(item)">📌</button>
                <button class="min-h-9 min-w-9 text-xs text-theme-tertiary transition-colors hover:text-theme-primary"
                  title="编辑" @click="router.push(`/notebook/care/${item.id}/edit`)">✎</button>
                <button class="min-h-9 min-w-9 text-xs danger-link" title="删除" @click="remove(item)">×</button>
              </div>
            </div>

            <PinMenu v-if="pinTarget?.id === item.id" target-type="care" :target-id="item.id"
              :scope="item.pin_scope || 'none'" @close="pinTarget = null" @change="load" />
          </div>

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

    <button class="btn-primary w-full" @click="router.push('/notebook/care/new')">＋ 添加档案</button>
  </div>
</template>
