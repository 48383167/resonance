<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createCapsule } from '../capsule.api.js'
import { toast } from '../../../stores/toast'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'
import ImageUpload from '../../../shared/components/ImageUpload.vue'

// 密封时间胶囊：独立页面
const router = useRouter()
const busy = ref(false)
const form = ref({ title: '', content: '', photoUrl: '', unlockDate: '' })

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/capsules')
}

async function seal() {
  if (busy.value) return
  if (!form.value.content.trim()) return toast('胶囊内容不能为空')
  if (!form.value.unlockDate) return toast('选择解锁日期')
  busy.value = true
  try {
    await createCapsule({ ...form.value, content: form.value.content.trim() })
    toast('胶囊已密封 ⏳')
    router.push('/capsules')
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
      <span class="text-xs text-white/40">把话寄给未来的你们，到期才能打开</span>
    </div>
    <h2 class="serif mb-4 text-xl">密封时间胶囊</h2>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">标题（可留空）</label>
      <input v-model="form.title" class="input-dark" placeholder="给未来起个名字" maxlength="30" />
    </div>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">写给未来你们的话</label>
      <textarea v-model="form.content" class="input-dark resize-none" rows="6" placeholder="写给未来你们的话…" />
    </div>

    <div class="glass mb-4 p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-white/50">解锁日期</label>
          <AppDatePicker v-model="form.unlockDate" placeholder="何时开启" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">配图（可留空）</label>
          <ImageUpload v-model="form.photoUrl" :multiple="false" accept="all" :max="1" />
        </div>
      </div>
    </div>

    <div class="flex items-center justify-end gap-3">
      <button class="btn-ghost" :disabled="busy" @click="goBack">取消</button>
      <button class="btn-primary" :disabled="busy || !form.content.trim() || !form.unlockDate" @click="seal">
        {{ busy ? '密封中…' : '密封 ⏳' }}
      </button>
    </div>
  </div>
</template>
