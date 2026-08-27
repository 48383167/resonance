<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAlbum, updateAlbum } from '../album.api.js'
import { toast } from '../../../stores/toast'

// 编辑相册信息：独立页面
const route = useRoute()
const router = useRouter()
const albumId = route.params.id
const busy = ref(false)
const form = ref({ name: '', description: '' })

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push(`/albums/${albumId}`)
}

onMounted(async () => {
  try {
    const a = await getAlbum(albumId)
    form.value = { name: a.name, description: a.description || '' }
  } catch (e) {
    toast(e.message)
    router.push('/albums')
  }
})

async function save() {
  if (busy.value) return
  if (!form.value.name.trim()) return toast('相册名不能为空')
  busy.value = true
  try {
    await updateAlbum(albumId, { name: form.value.name.trim(), description: form.value.description })
    toast('相册信息已更新')
    router.push(`/albums/${albumId}`)
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
      <span class="text-xs text-white/40 sm:text-right">修改相册的名字与描述</span>
    </div>
    <h2 class="serif mb-4 text-xl">编辑相册信息</h2>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">相册名</label>
      <input v-model="form.name" class="input-dark" placeholder="相册名" maxlength="20" />
    </div>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">描述（可留空）</label>
      <textarea v-model="form.description" class="input-dark resize-none" rows="3" placeholder="这本相册记录了…" />
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <button class="btn-ghost w-full sm:w-auto" :disabled="busy" @click="goBack">取消</button>
      <button class="btn-primary w-full sm:w-auto" :disabled="busy || !form.name.trim()" @click="save">
        {{ busy ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
