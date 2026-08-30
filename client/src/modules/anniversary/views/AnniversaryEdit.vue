<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAnniversary, createAnniversary, updateAnniversary } from '../anniversary.api.js'
import { toast } from '../../../stores/toast'
import AppSelect from '../../../shared/components/AppSelect.vue'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'

// 添加 / 编辑纪念日：独立页面
const route = useRoute()
const router = useRouter()
const editingId = route.params.id || null
const busy = ref(false)
let createKey = null
const form = ref({ title: '', type: 'custom', date: '', description: '' })

const TYPES = [
  { value: 'first_meet', label: '初遇', icon: '🌸' },
  { value: 'together', label: '在一起', icon: '💞' },
  { value: 'birthday', label: '生日', icon: '🎂' },
  { value: 'custom', label: '自定义', icon: '✨' },
]

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/anniversaries')
}

onMounted(async () => {
  if (!editingId) return
  try {
    const a = await getAnniversary(editingId)
    form.value = { title: a.title, type: a.type, date: a.date, description: a.description }
  } catch (e) {
    toast(e.message)
    router.push('/anniversaries')
  }
})

async function save() {
  if (busy.value) return
  if (!form.value.title.trim() || !form.value.date) return toast('填写名称和日期')
  busy.value = true
  try {
    const payload = { ...form.value, title: form.value.title.trim() }
    if (editingId) await updateAnniversary(editingId, payload)
    else {
      createKey ||= generateIdempotencyKey()
      await createAnniversary(payload, createKey)
      createKey = null
    }
    toast(editingId ? '纪念日已更新' : '纪念日已添加 📅')
    router.push('/anniversaries')
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
      <span class="text-xs text-white/40 sm:text-right">{{ editingId ? '修改这个日子' : '初遇、在一起、生日…' }}</span>
    </div>
    <h2 class="serif mb-4 text-xl">{{ editingId ? '编辑纪念日' : '添加纪念日' }}</h2>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">名称</label>
      <input v-model="form.title" class="input-dark" placeholder="如：第一次见面" maxlength="30" />
    </div>

    <div class="glass relative z-20 mb-4 p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-white/50">类型</label>
          <AppSelect v-model="form.type" :options="TYPES" placeholder="类型" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">日期</label>
          <AppDatePicker v-model="form.date" placeholder="选择日期" />
        </div>
      </div>
    </div>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">描述（可留空）</label>
      <textarea v-model="form.description" class="input-dark resize-none" rows="3" placeholder="描述（可留空）" />
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <button class="btn-ghost w-full sm:w-auto" :disabled="busy" @click="goBack">取消</button>
      <button class="btn-primary w-full sm:w-auto" :disabled="busy || !form.title.trim() || !form.date" @click="save">
        {{ busy ? '保存中…' : (editingId ? '保存修改' : '保存') }}
      </button>
    </div>
  </div>
</template>
