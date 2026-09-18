<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRule, getRule, updateRule, removeRule } from '../rule.api.js'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'
import { loadFormDraft, saveFormDraft, clearFormDraft } from '../../../utils/draft.js'
import { parseContentToItems, splitItemsByState, itemsTextKey, MAX_ITEMS } from '../../../utils/ruleItems.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import RuleItemRows from '../components/RuleItemRows.vue'

// 新增 / 编辑规矩：底线 / 约定 / 建议
// 条目逐条输入（回车续行、粘贴多行自动拆分、可拖动排序），编辑时行尾显示认同状态。
const route = useRoute()
const router = useRouter()
const editingId = route.params.id || null
const busy = ref(false)
let createKey = null

const TYPES = [
  { value: 'redline', label: '底线', help: '绝不可违背的事' },
  { value: 'rule', label: '约定', help: '我们商量好的事' },
  { value: 'suggestion', label: '建议', help: '可以试试的小事' },
]

const DRAFT_KEY = 'rule-new'

let seq = 0
const rowKey = () => `row_${Date.now().toString(36)}_${++seq}`

function initialForm() {
  return {
    type: route.query.type || 'rule',
    title: '',
    rows: [{ key: rowKey(), text: '' }],
    status: 'active',
  }
}

function itemToRow(item) {
  return {
    key: rowKey(),
    id: item.id,
    text: item.text,
    originalText: item.text,
    agreedIds: item.agreedIds || [],
    effective: Boolean(item.effective),
  }
}

const form = ref(initialForm())
const draftRestored = ref(false)
const archivedItems = ref([]) // 编辑时已停用条目（原样保留，可在本页恢复）
const original = ref(null)

// 新建时缓存草稿（与日记一致）：进入恢复、保存成功后清除；编辑模式不缓存
if (!editingId) {
  const draft = loadFormDraft(DRAFT_KEY)
  if (draft) {
    const rows = Array.isArray(draft.rows) && draft.rows.length
      ? draft.rows.map((r) => ({ key: rowKey(), text: String(r?.text ?? '') }))
      : parseContentToItems(draft.text ?? draft.content ?? '').map((text) => ({ key: rowKey(), text }))
    form.value = {
      ...initialForm(),
      type: draft.type || 'rule',
      title: draft.title || '',
      rows: rows.length ? rows : initialForm().rows,
      status: draft.status || 'active',
    }
    draftRestored.value = true
  }
}
watch(form, (value) => {
  if (editingId) return
  saveFormDraft(DRAFT_KEY, {
    type: value.type,
    title: value.title,
    status: value.status,
    rows: value.rows.map((r) => ({ text: r.text })),
  })
}, { deep: true })

function discardDraft() {
  form.value = initialForm()
  nextTick(() => clearFormDraft(DRAFT_KEY))
  draftRestored.value = false
  toast('草稿已清空')
}

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push({ path: '/notebook', query: { tab: 'rule' } })
}

// 保存时真正提交的条目：有效行（保留已有 id）+ 保持停用的
const validRows = computed(() => form.value.rows.filter((r) => r.text.trim()))
const totalCount = computed(() => validRows.value.length + archivedItems.value.length)
const tooMany = computed(() => totalCount.value > MAX_ITEMS)
const submitItems = computed(() => [
  ...validRows.value.map((r) =>
    (r.id ? { id: r.id, text: r.text.trim(), state: 'active' } : { text: r.text.trim(), state: 'active' })),
  ...archivedItems.value.map((it) => ({ id: it.id, text: it.text, state: 'archived' })),
])

// 编辑已生效规矩时，内容有实质变化才提示需要重新认同（纯改标题/换行不算）
const substantive = computed(() => {
  if (!editingId || !original.value) return false
  if (form.value.type !== original.value.type) return true
  if (form.value.title.trim() !== original.value.title) return true
  return itemsTextKey(submitItems.value) !== original.value.itemsKey
})

// 单条停用：新条目直接删除，已有条目（含 id 与原认同）移入已停用
function archiveRow(row) {
  const idx = form.value.rows.findIndex((r) => r.key === row.key)
  if (idx < 0) return
  const [removed] = form.value.rows.splice(idx, 1)
  if (!removed.id) return
  archivedItems.value.push({
    id: removed.id,
    text: removed.text.trim() || removed.originalText || '',
    state: 'archived',
    agreedIds: removed.agreedIds || [],
    effective: Boolean(removed.effective),
  })
}

function restoreArchived(item) {
  archivedItems.value = archivedItems.value.filter((it) => it.id !== item.id)
  form.value.rows.push(itemToRow(item))
}

onMounted(async () => {
  if (!editingId) {
    if (draftRestored.value) toast('已恢复上次未保存的草稿 ✏️')
    return
  }
  try {
    const rule = await getRule(editingId)
    const { active, archived } = splitItemsByState(rule.items)
    form.value = {
      type: rule.type,
      title: rule.title,
      rows: active.map(itemToRow),
      status: rule.status,
    }
    archivedItems.value = archived.map((it) => ({ ...it }))
    original.value = { type: rule.type, title: rule.title, itemsKey: itemsTextKey(rule.items) }
  } catch (e) {
    toast(e.message)
    goBack()
  }
})

async function save() {
  if (busy.value) return
  if (!form.value.title.trim()) return toast('请填写标题')
  if (tooMany.value) return toast(`一条规矩最多 ${MAX_ITEMS} 条`)
  busy.value = true
  try {
    const data = { type: form.value.type, title: form.value.title.trim(), items: submitItems.value }
    if (editingId) {
      data.status = form.value.status
      await updateRule(editingId, data)
    } else {
      createKey ||= generateIdempotencyKey()
      await createRule(data, createKey)
      createKey = null
      clearFormDraft(DRAFT_KEY)
      draftRestored.value = false
    }
    toast(editingId ? '规矩已更新' : '规矩已记下')
    router.push({ path: '/notebook', query: { tab: 'rule' } })
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}

async function remove() {
  const ok = await confirmDialog({ title: '删除规矩', message: '确定删除这条规矩吗？' })
  if (!ok) return
  try {
    await removeRule(editingId)
    goBack()
  } catch (e) {
    toast(e.message)
  }
}
</script>

<template>
  <div class="fade-up">
    <button class="btn-ghost mb-4 text-sm" @click="goBack">← 返回</button>
    <h1 class="serif mb-4 text-xl">{{ editingId ? '编辑规矩' : '添加规矩' }}</h1>

    <div v-if="draftRestored"
      class="surface-soft mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-xs text-theme-secondary">
      <span>✏️ 已恢复上次未保存的草稿</span>
      <button class="shrink-0 text-xs hover:text-theme-primary" @click="discardDraft">清空草稿</button>
    </div>

    <div class="glass space-y-4 p-4 sm:p-5">
      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">类型</label>
        <div class="flex gap-2 overflow-x-auto">
          <button v-for="t in TYPES" :key="t.value"
            class="min-h-11 min-w-24 rounded-xl px-3 transition-colors"
            :class="form.type === t.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
            @click="form.type = t.value">
            {{ t.label }}
          </button>
        </div>
        <p class="mt-2 text-xs text-theme-tertiary">{{ TYPES.find(t => t.value === form.type)?.help }}</p>
      </div>

      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">标题</label>
        <input v-model="form.title" class="input-dark" maxlength="80" placeholder="比如：吵架不过夜" />
      </div>

      <RuleItemRows :rows="form.rows" :show-status="Boolean(editingId)"
        :max="MAX_ITEMS - archivedItems.length" @limit="toast(`一条规矩最多 ${MAX_ITEMS} 条`)" />

      <div v-if="archivedItems.length" class="surface-soft rounded-xl p-3">
        <p class="mb-2 text-xs text-theme-tertiary">已停用 {{ archivedItems.length }} 条（保存后仍保持停用，点一下恢复）</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="item in archivedItems" :key="item.id"
            class="flex min-h-9 max-w-full items-center gap-1.5 rounded-full px-3 text-xs text-theme-secondary transition-colors hover:text-accent"
            @click="restoreArchived(item)">
            <span class="min-w-0 truncate line-through opacity-60">{{ item.text }}</span>
            <span class="shrink-0">恢复</span>
          </button>
        </div>
      </div>

      <p v-if="substantive" class="rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent">
        ⚠️ 改动的条目保存后需要 Ta 重新认同（未改动的条目认同不受影响）
      </p>

      <div v-if="editingId">
        <label class="mb-1 block text-xs text-theme-tertiary">状态</label>
        <div class="flex gap-2">
          <button class="min-h-11 flex-1 rounded-xl transition-colors"
            :class="form.status === 'active' ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
            @click="form.status = 'active'">生效中</button>
          <button class="min-h-11 flex-1 rounded-xl transition-colors"
            :class="form.status === 'archived' ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
            @click="form.status = 'archived'">已停用</button>
        </div>
      </div>
    </div>

    <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <button v-if="editingId" class="danger-link min-h-11 px-4 text-sm" @click="remove">删除</button>
      <button class="btn-ghost w-full sm:w-auto" @click="goBack">取消</button>
      <button class="btn-primary w-full sm:w-auto" :disabled="busy" @click="save">
        {{ busy ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
