<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { toast } from '../stores/toast'

// 写情书 / 编辑情书：独立页面（纸感书写）
const route = useRoute()
const router = useRouter()
const editingId = route.params.id || null
const busy = ref(false)
const title = ref('')
const content = ref('')
const isSecret = ref(false)

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/letters')
}

onMounted(async () => {
  if (!editingId) return
  try {
    const l = await api.get(`/api/letters/${editingId}`)
    title.value = l.title
    content.value = l.content
    isSecret.value = Boolean(l.is_secret)
  } catch (e) {
    toast(e.message)
    router.push('/letters')
  }
})

async function send() {
  if (busy.value) return
  if (!content.value.trim()) return toast('信的内容不能为空')
  busy.value = true
  try {
    const payload = {
      title: title.value.trim(),
      content: content.value.trim(),
      isSecret: isSecret.value,
    }
    if (editingId) await api.put(`/api/letters/${editingId}`, payload)
    else await api.post('/api/letters', payload)
    toast(editingId ? '情书已更新 💌' : '情书已送出 💌')
    router.push(editingId ? `/letters/${editingId}` : '/letters')
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fade-up">
    <div class="mb-4 flex items-center justify-between">
      <button class="btn-ghost text-sm" @click="goBack">← 返回</button>
      <span class="text-xs text-white/40">{{ editingId ? '修改这封信' : '写一封只给 Ta 看的信' }}</span>
    </div>
    <h2 class="serif mb-4 text-xl">{{ editingId ? '编辑情书' : (isSecret ? '🔐 写一封秘密信件' : '✎ 写情书') }}</h2>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">标题（可留空）</label>
      <input v-model="title" class="input-dark" placeholder="致亲爱的你" maxlength="30" />
    </div>

    <!-- 纸面书写区 -->
    <div class="paper-card relative mb-4 p-6">
      <textarea v-model="content" rows="12"
        class="serif w-full resize-none bg-transparent leading-loose outline-none"
        placeholder="铺开信纸，慢慢说…" />
      <div class="paper-lines pointer-events-none absolute inset-x-8 top-24 bottom-8" />
    </div>

    <div class="mb-4 flex items-center justify-between">
      <label class="flex cursor-pointer items-center gap-2 text-sm text-white/60">
        <input v-model="isSecret" type="checkbox" class="accent-violet-400" />
        🔐 秘密信件
      </label>
      <span class="text-xs text-white/40">{{ content.length }} 字</span>
    </div>

    <div class="flex items-center justify-end gap-3">
      <button class="btn-ghost" :disabled="busy" @click="goBack">取消</button>
      <button class="btn-primary" :disabled="busy || !content.trim()" @click="send">
        {{ busy ? (editingId ? '保存中…' : '寄送中…') : (editingId ? '保存修改' : '💌 送出这封信') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.paper-card {
  background: linear-gradient(160deg, #f7f0df, #efe4cc);
  border: 1px solid rgba(120, 90, 40, 0.18);
  border-radius: 10px;
  color: #3a2c1a;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35), inset 0 0 30px rgba(150, 120, 70, 0.12);
}
.paper-lines {
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 26px,
    rgba(90, 70, 40, 0.12) 26px,
    rgba(90, 70, 40, 0.12) 27px
  );
}
</style>
