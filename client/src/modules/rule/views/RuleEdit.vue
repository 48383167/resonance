<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRule, getRule, updateRule, removeRule } from '../rule.api.js'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'

// 新增 / 编辑规矩：底线 / 约定 / 建议
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

const form = ref({
  type: route.query.type || 'rule',
  title: '',
  content: '',
  status: 'active',
})

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push({ path: '/notebook', query: { tab: 'rule' } })
}

onMounted(async () => {
  if (!editingId) return
  try {
    const rule = await getRule(editingId)
    form.value = { type: rule.type, title: rule.title, content: rule.content || '', status: rule.status }
  } catch (e) {
    toast(e.message)
    goBack()
  }
})

async function save() {
  if (busy.value) return
  if (!form.value.title.trim()) return toast('请填写标题')
  busy.value = true
  try {
    const data = { type: form.value.type, title: form.value.title.trim(), content: form.value.content }
    if (editingId) {
      data.status = form.value.status
      await updateRule(editingId, data)
    } else {
      createKey ||= generateIdempotencyKey()
      await createRule(data, createKey)
      createKey = null
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

    <div class="glass space-y-4 p-5">
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

      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">内容（可留空）</label>
        <textarea v-model="form.content" class="input-dark resize-none" rows="5" maxlength="2000"
          placeholder="写清具体怎么做，Ta 更容易认同" />
      </div>

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
