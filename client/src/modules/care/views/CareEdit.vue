<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createCareItem, getCareItem, updateCareItem, removeCareItem } from '../care.api.js'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'
import { loadFormDraft, saveFormDraft, clearFormDraft } from '../../../utils/draft.js'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import AppSelect from '../../../shared/components/AppSelect.vue'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'

// 新增 / 编辑关怀档案：分类决定显示哪些字段
const route = useRoute()
const router = useRouter()
const editingId = route.params.id || null
const busy = ref(false)
let createKey = null

// 例假是独立流程（例假 Tab / 后端固定女性），不出现在档案的分类选择里
const CATEGORIES = [
  { value: 'diet', label: '🍽️ 忌口' },
  { value: 'allergy', label: '⚠️ 过敏' },
  { value: 'preference', label: '💗 偏好' },
  { value: 'other', label: '📎 其他' },
]
const PERIOD_LABEL = '🌸 例假（固定记录到女生一方）'
const SEVERITIES = [
  { value: 'mild', label: '轻度' },
  { value: 'moderate', label: '中度' },
  { value: 'severe', label: '重度' },
]

// 缺省对象：默认 Ta（例假由后端固定到女性一方，不需要手动选）
function defaultSubjectFor() {
  return session.partner?.id || session.userId
}

const initialCategory = route.query.category || 'diet'
const DRAFT_KEY = `care-new-${initialCategory}`

function initialForm() {
  return {
    category: initialCategory,
    subjectId: route.query.subject || defaultSubjectFor(),
    title: initialCategory === 'period' ? '例假记录' : '',
    content: '',
    severity: 'mild',
    startDate: '',
    endDate: '',
    cycleDays: '',
  }
}

const form = ref(initialForm())
const draftRestored = ref(false)
const isPeriod = computed(() => form.value.category === 'period')

// 新建时缓存草稿（与日记一致）：进入恢复、保存成功后清除；编辑模式不缓存
if (!editingId) {
  const draft = loadFormDraft(DRAFT_KEY)
  if (draft) {
    form.value = { ...initialForm(), ...draft }
    draftRestored.value = true
  }
}
watch(form, (value) => {
  if (editingId) return
  saveFormDraft(DRAFT_KEY, value)
}, { deep: true })

function discardDraft() {
  form.value = initialForm()
  nextTick(() => clearFormDraft(DRAFT_KEY))
  draftRestored.value = false
  toast('草稿已清空')
}

// 用户手动选过对象后，切分类不再覆盖
let subjectTouched = false
function pickSubject(id) {
  subjectTouched = true
  form.value.subjectId = id
}
watch(() => form.value.category, () => {
  if (!subjectTouched) form.value.subjectId = defaultSubjectFor()
})

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/notebook')
}

onMounted(async () => {
  if (!editingId) {
    if (draftRestored.value) toast('已恢复上次未保存的草稿 ✏️')
    return
  }
  try {
    const item = await getCareItem(editingId)
    form.value = {
      category: item.category,
      subjectId: item.subject_id,
      title: item.title,
      content: item.content || '',
      severity: item.severity || 'mild',
      startDate: item.start_date || '',
      endDate: item.end_date || '',
      cycleDays: item.cycle_days || '',
    }
  } catch (e) {
    toast(e.message)
    goBack()
  }
})

async function save() {
  if (busy.value) return
  if (!form.value.title.trim()) return toast('请填写标题')
  if (form.value.category === 'period' && !form.value.startDate) return toast('请填写开始日期')
  busy.value = true
  try {
    const data = {
      ...form.value,
      title: form.value.title.trim(),
      cycleDays: form.value.cycleDays ? Number(form.value.cycleDays) : undefined,
    }
    if (data.category !== 'allergy') delete data.severity
    if (data.category !== 'period') {
      delete data.startDate
      delete data.endDate
      delete data.cycleDays
    } else {
      // 例假固定到女性一方，对象由后端决定
      delete data.subjectId
    }
    if (editingId) {
      await updateCareItem(editingId, data)
    } else {
      createKey ||= generateIdempotencyKey()
      await createCareItem(data, createKey)
      createKey = null
      clearFormDraft(DRAFT_KEY)
      draftRestored.value = false
    }
    toast(editingId ? '档案已更新' : '档案已记下')
    router.push('/notebook')
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}

async function remove() {
  const ok = await confirmDialog({ title: '删除档案', message: '确定删除这条档案吗？' })
  if (!ok) return
  try {
    await removeCareItem(editingId)
    goBack()
  } catch (e) {
    toast(e.message)
  }
}
</script>

<template>
  <div class="fade-up">
    <button class="btn-ghost mb-4 text-sm" @click="goBack">← 返回</button>
    <h1 class="serif mb-4 text-xl">{{ editingId ? '编辑档案' : '添加档案' }}</h1>

    <div v-if="draftRestored"
      class="surface-soft mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-xs text-theme-secondary">
      <span>✏️ 已恢复上次未保存的草稿</span>
      <button class="shrink-0 text-xs hover:text-theme-primary" @click="discardDraft">清空草稿</button>
    </div>

    <div class="glass space-y-4 p-5">
      <div v-if="isPeriod">
        <label class="mb-1 block text-xs text-theme-tertiary">分类</label>
        <div class="surface-soft flex min-h-11 items-center rounded-xl px-4 text-sm text-theme-secondary">{{ PERIOD_LABEL }}</div>
      </div>
      <div v-else>
        <label class="mb-1 block text-xs text-theme-tertiary">分类</label>
        <AppSelect v-model="form.category" :options="CATEGORIES" placeholder="选择分类" />
      </div>

      <div v-if="form.category === 'period'" class="surface-soft rounded-xl px-4 py-3 text-xs text-theme-secondary">
        🌸 例假固定记录到女生一方，不需要选择对象
      </div>
      <div v-else>
        <label class="mb-1 block text-xs text-theme-tertiary">关于谁</label>
        <div class="flex gap-2">
          <button v-for="s in [{ id: session.userId, label: '我' }, { id: session.partner?.id, label: 'Ta' }]"
            :key="s.label" :disabled="!s.id"
            class="min-h-11 flex-1 rounded-xl transition-colors disabled:opacity-40"
            :class="form.subjectId === s.id ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
            @click="pickSubject(s.id)">
            {{ s.label }}
          </button>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">标题</label>
        <input v-model="form.title" class="input-dark" maxlength="80" placeholder="比如：不喜欢香菜" />
      </div>

      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">内容（可留空）</label>
        <textarea v-model="form.content" class="input-dark resize-none" rows="4" maxlength="2000"
          placeholder="补充说明，比如：严重时会呼吸急促" />
      </div>

      <div v-if="form.category === 'allergy'">
        <label class="mb-1 block text-xs text-theme-tertiary">严重程度</label>
        <AppSelect v-model="form.severity" :options="SEVERITIES" placeholder="选择程度" />
      </div>

      <template v-if="form.category === 'period'">
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">开始日期 *</label>
          <AppDatePicker v-model="form.startDate" placeholder="选择开始日期" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">结束日期（可空）</label>
          <AppDatePicker v-model="form.endDate" placeholder="选择结束日期" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">周期天数（15~60，可空）</label>
          <input v-model="form.cycleDays" type="number" min="15" max="60" class="input-dark" placeholder="不填则由系统按历史智能推算" />
        </div>
      </template>
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
