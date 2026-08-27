<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWish, createWish, updateWish } from '../wish.api.js'
import { toast } from '../../../stores/toast'
import AppSelect from '../../../shared/components/AppSelect.vue'

// 许愿 / 编辑心愿：独立页面
const route = useRoute()
const router = useRouter()
const editingId = route.params.id || null
const busy = ref(false)
const form = ref({ title: '', description: '', category: 'other', priority: 0 })

const CATEGORIES = [
  { value: 'travel', label: '旅行', icon: '✈️' },
  { value: 'food', label: '美食', icon: '🍜' },
  { value: 'gift', label: '礼物', icon: '🎁' },
  { value: 'life', label: '生活', icon: '🏠' },
  { value: 'other', label: '其他', icon: '✨' },
]
const PRIORITIES = [
  { value: 0, label: '普通', icon: '·' },
  { value: 1, label: '重要', icon: '🔶' },
  { value: 2, label: '非常想', icon: '⭐' },
]

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/wishes')
}

onMounted(async () => {
  if (!editingId) return
  try {
    const w = await getWish(editingId)
    form.value = { title: w.title, description: w.description, category: w.category, priority: w.priority }
  } catch (e) {
    toast(e.message)
    router.push('/wishes')
  }
})

async function save() {
  if (busy.value) return
  if (!form.value.title.trim()) return toast('写个心愿吧')
  busy.value = true
  try {
    const payload = { ...form.value, title: form.value.title.trim() }
    if (editingId) await updateWish(editingId, payload)
    else await createWish(payload)
    toast(editingId ? '心愿已更新' : '心愿已许下 ✨')
    router.push(editingId ? `/wishes/${editingId}` : '/wishes')
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fade-up">
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button class="btn-ghost text-sm" @click="goBack">← 返回</button>
      <span class="text-xs text-white/40 sm:text-right">{{ editingId ? '修改这个心愿' : '想一起做的事' }}</span>
    </div>
    <h2 class="serif mb-4 text-xl">{{ editingId ? '编辑心愿' : '许个心愿' }}</h2>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">想一起做什么</label>
      <input v-model="form.title" class="input-dark" placeholder="想做什么？" maxlength="40" />
    </div>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">补充说明（可留空）</label>
      <textarea v-model="form.description" class="input-dark resize-none" rows="3" placeholder="补充说明（可留空）" />
    </div>

    <div class="glass mb-4 p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-white/50">分类</label>
          <AppSelect v-model="form.category" :options="CATEGORIES" placeholder="选择分类" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">优先级</label>
          <AppSelect v-model="form.priority" :options="PRIORITIES" placeholder="优先级" />
        </div>
      </div>
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <button class="btn-ghost w-full sm:w-auto" :disabled="busy" @click="goBack">取消</button>
      <button class="btn-primary w-full sm:w-auto" :disabled="busy || !form.title.trim()" @click="save">
        {{ busy ? '保存中…' : (editingId ? '保存修改' : '许下心愿') }}
      </button>
    </div>
  </div>
</template>
