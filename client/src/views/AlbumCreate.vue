<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { toast } from '../stores/toast'
import ImageUpload from '../components/ImageUpload.vue'

// 新建相册：独立页面（与写日记/记录瞬间/写信一致的整页体验）
const router = useRouter()
const creating = ref(false)
// 封面与图片集相互独立：可单独上传；不设置则列表用第一张照片代替展示
const form = ref({ name: '', description: '', coverUrl: '' })

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/albums')
}

async function create() {
  if (!form.value.name.trim()) return toast('给相册起个名字')
  creating.value = true
  try {
    const album = await api.post('/api/albums', {
      name: form.value.name.trim(),
      description: form.value.description,
      coverUrl: form.value.coverUrl,
    })
    toast('相册已创建')
    router.push(`/albums/${album.id}`)
  } catch (e) {
    toast(e.message)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="fade-up">
    <div class="mb-4 flex items-center justify-between">
      <button class="btn-ghost text-sm" @click="goBack">← 返回</button>
      <span class="text-xs text-white/40">把照片和回忆收进册子</span>
    </div>
    <h2 class="serif mb-4 text-xl">新建相册</h2>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">相册名</label>
      <input v-model="form.name" class="input-dark" placeholder="如：第一次旅行" maxlength="20" />
    </div>

    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">描述（可留空）</label>
      <textarea v-model="form.description" class="input-dark resize-none" rows="3" placeholder="这本相册记录了…" />
    </div>

    <div class="glass mb-4 p-5">
      <label class="mb-2 block text-xs text-white/50">封面（可留空；与图片集独立，不上传则展示时以第一张照片代替）</label>
      <ImageUpload v-model="form.coverUrl" :multiple="false" accept="image" :max="1" />
    </div>

    <div class="flex items-center justify-end gap-3">
      <button class="btn-ghost" :disabled="creating" @click="goBack">取消</button>
      <button class="btn-primary" :disabled="creating || !form.name.trim()" @click="create">
        {{ creating ? '创建中…' : '创建' }}
      </button>
    </div>
  </div>
</template>
