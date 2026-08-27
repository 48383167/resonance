<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDiary } from '../diary.api.js'
import { timeColorHex } from '../../../composables/useAmbient'
import { toast } from '../../../stores/toast'
import EmotionEditor from '../components/EmotionEditor.vue'
import ImageUpload from '../../../shared/components/ImageUpload.vue'
import WeatherPicker from '../components/WeatherPicker.vue'

const router = useRouter()
const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/diary-list')
}

const title = ref('')
const busy = ref(false)
const weather = ref(null)
const editorRef = ref(null)
const media = ref([])

const TITLE_KEY = 'resonance.draft.solo-title'

try {
  title.value = localStorage.getItem(TITLE_KEY) || ''
} catch { /* 忽略 */ }

function onTitleInput() {
  try { localStorage.setItem(TITLE_KEY, title.value) } catch { /* 忽略 */ }
}

function onRestore() {
  toast('已恢复上次未写完的草稿 ✏️')
}

async function submit(payload) {
  if (busy.value) return
  busy.value = true
  try {
    await createDiary({
      ...payload,
      title: title.value.trim(),
      weatherCode: weather.value,
      timeColorHex: timeColorHex(),
      media: media.value.filter((m) => m?.id).map((m) => ({ fileId: m.id, type: m.type || 'file' })),
    })
    localStorage.removeItem(TITLE_KEY)
    editorRef.value?.clearDraft()
    toast('日记已封存 📔')
    router.push('/timeline')
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
      <span class="text-xs text-white/40">情绪墨水会在落笔时悄悄采集</span>
    </div>
    <h2 class="serif mb-4 text-xl">写日记</h2>
    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">标题（可留空）</label>
      <input v-model="title" class="input-dark" placeholder="给此刻起个名字" maxlength="30" @input="onTitleInput" />
    </div>
    <div class="glass mb-4 p-5">
      <label class="mb-2 block text-xs text-white/50">此刻天气（可留空，点一下选中、再点取消）</label>
      <WeatherPicker v-model="weather" />
    </div>
    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">照片 / 视频 / 附件（可留空）</label>
      <ImageUpload v-model="media" accept="all" />
    </div>
    <EmotionEditor ref="editorRef" draft-key="solo" submit-text="封存此刻" :disabled="busy"
      @submit="submit" @restore="onRestore" />
  </div>
</template>
