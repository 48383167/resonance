<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createDiary, getDiary, updateDiary } from '../diary.api.js'
import { timeColorHex } from '../../../composables/useAmbient'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import EmotionEditor from '../components/EmotionEditor.vue'
import ImageUpload from '../../../shared/components/ImageUpload.vue'
import WeatherPicker from '../components/WeatherPicker.vue'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'

const router = useRouter()
const route = useRoute()
const editingId = route.params.id || null
const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/diary-list')
}

const title = ref('')
const busy = ref(false)
let createKey = null
const loading = ref(Boolean(editingId))
const weather = ref(null)
const editorRef = ref(null)
const media = ref([])
const savedTimeColor = ref(null)

const TITLE_KEY = 'resonance.draft.solo-title'

if (!editingId) {
  try {
    title.value = localStorage.getItem(TITLE_KEY) || ''
  } catch { /* 忽略 */ }
}

onMounted(async () => {
  if (!editingId) return
  try {
    const entry = await getDiary(editingId)
    title.value = entry.title || ''
    weather.value = entry.weather_code == null ? null : Number(entry.weather_code)
    savedTimeColor.value = entry.time_color_hex || null
    media.value = (entry.media || []).map((item) => ({
      id: item.id || '',
      url: item.url || '',
      type: item.type || 'file',
      name: item.name || '',
    }))
    const content = entry.contents?.find((item) => item.user_id === session.userId) || entry.contents?.[0]
    if (!content) throw new Error('日记内容不存在')
    editorRef.value?.setContent(content.content, {
      wpm: content.typing_speed,
      backspaceCount: content.delete_count,
      pauseDuration: content.pause_duration,
    })
  } catch (e) {
    toast(e.message)
    router.push('/diary-list')
  } finally {
    loading.value = false
  }
})

function onTitleInput() {
  if (editingId) return
  try { localStorage.setItem(TITLE_KEY, title.value) } catch { /* 忽略 */ }
}

function onRestore() {
  toast('已恢复上次未写完的草稿 ✏️')
}

async function submit(payload) {
  if (busy.value || loading.value) return
  busy.value = true
  try {
    const selectedMedia = media.value
      .filter((m) => m?.id || (editingId && m?.url))
      .map((m) => m.id
        ? { fileId: m.id, type: m.type || 'file' }
        : { url: m.url, type: m.type || 'file' })
    const data = {
      ...payload,
      title: title.value.trim(),
      weatherCode: weather.value,
      timeColorHex: editingId ? savedTimeColor.value : timeColorHex(),
      media: selectedMedia,
    }
    if (editingId) await updateDiary(editingId, data)
    else {
      createKey ||= generateIdempotencyKey()
      await createDiary(data, createKey)
      createKey = null
    }
    if (!editingId) localStorage.removeItem(TITLE_KEY)
    editorRef.value?.clearDraft()
    toast(editingId ? '日记已更新 📔' : '日记已封存 📔')
    router.push(editingId ? `/entry/${editingId}` : '/timeline')
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
      <span class="text-xs text-white/40 sm:text-right">{{ editingId ? '修改这篇日记的内容与环境' : '情绪墨水会在落笔时悄悄采集' }}</span>
    </div>
    <h2 class="serif mb-4 text-xl">{{ editingId ? '编辑日记' : '写日记' }}</h2>
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
    <EmotionEditor ref="editorRef" :draft-key="editingId ? '' : 'solo'"
      :submit-text="editingId ? '保存修改' : '封存此刻'" :disabled="busy || loading"
      @submit="submit" @restore="onRestore" />
  </div>
</template>
