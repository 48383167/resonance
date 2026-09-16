<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listCareItems, removeCareItem } from '../care.api.js'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import PinMenu from '../../../shared/components/PinMenu.vue'

// 关怀档案列表：分类 / 对象筛选（前端过滤）+ 列表置顶 + 编辑删除
const router = useRouter()
const items = ref([])
const category = ref('')
const subjectId = ref('')
const pinTarget = ref(null)

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

function severityClass(severity) {
  if (severity === 'severe') return 'danger-link'
  if (severity === 'moderate') return 'text-accent-2'
  return 'text-theme-tertiary'
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
      <section v-for="group in groups" :key="group.value">
        <h3 class="mb-2 text-sm text-theme-secondary">{{ group.label }}</h3>
        <div class="space-y-3">
          <article v-for="item in group.items" :key="item.id" class="glass fade-up relative p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="font-medium">{{ item.title }}</h4>
                  <span v-if="item.severity" class="text-xs" :class="severityClass(item.severity)">
                    {{ SEVERITY_LABELS[item.severity] }}
                  </span>
                  <span v-if="item.pin_scope" class="text-xs text-accent" title="已置顶">📌</span>
                </div>
                <p v-if="item.content" class="mt-2 whitespace-pre-wrap text-sm text-theme-secondary">{{ item.content }}</p>
                <p class="mt-3 text-xs text-theme-tertiary">
                  {{ item.author?.nickname || '我' }} 记录 · 关于 {{ item.subject?.nickname || (item.subject_id === session.userId ? '我' : 'Ta') }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button class="min-h-11 min-w-11 rounded-full transition-colors"
                  :class="pinTarget?.id === item.id ? 'text-accent' : 'text-theme-secondary hover:text-accent'"
                  title="设置置顶" @click="togglePin(item)">📌</button>
                <button class="min-h-11 px-2 text-xs text-theme-secondary hover:text-theme-primary"
                  @click="router.push(`/notebook/care/${item.id}/edit`)">编辑</button>
                <button class="min-h-11 px-2 text-xs danger-link" @click="remove(item)">删除</button>
              </div>
            </div>
            <PinMenu v-if="pinTarget?.id === item.id" target-type="care" :target-id="item.id"
              :scope="item.pin_scope || 'none'" @close="pinTarget = null" @change="load" />
          </article>
        </div>
      </section>
    </div>

    <div v-else class="glass p-8 text-center text-sm text-theme-tertiary">
      {{ filtering ? '没有符合筛选的档案，换个条件试试。' : '还没有关怀档案，把那些重要的小事记下来吧。' }}
    </div>

    <button class="btn-primary w-full" @click="router.push('/notebook/care/new')">＋ 添加档案</button>
  </div>
</template>
