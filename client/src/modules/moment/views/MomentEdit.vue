<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMoment, createMoment, updateMoment } from '../moment.api.js'
import { toast } from '../../../stores/toast'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'
import ImageUpload from '../../../shared/components/ImageUpload.vue'
import MapPicker from '../components/MapPicker.vue'

// 记录/编辑恋爱瞬间：独立页面（替代拥挤弹窗），风格对齐写日记页
const route = useRoute()
const router = useRouter()

// 智能返回控制
const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/moments')
}

const editingId = route.params.id || null
const busy = ref(false)

const MOODS = [
  { key: 'normal', emoji: '😌', label: '平静' },
  { key: 'happy', emoji: '😄', label: '开心' },
  { key: 'sweet', emoji: '🥰', label: '甜蜜' },
  { key: 'missed', emoji: '🥺', label: '想念' },
  { key: 'angry', emoji: '😠', label: '生气' },
  { key: 'sad', emoji: '😢', label: '难过' },
]

const content = ref('')
const mood = ref('normal')
const locationText = ref('')
const momentDate = ref('')
const photos = ref([])
const point = ref({ lat: null, lng: null, location: '' })

onMounted(async () => {
  if (!editingId) return
  try {
    const m = await getMoment(editingId)
    content.value = m.content
    mood.value = m.mood || 'normal'
    momentDate.value = m.moment_date || ''
    photos.value = (m.photos || []).map((p) => ({ id: p.id, url: p.url, type: p.type, name: p.name }))
    point.value = {
      lat: m.latitude ?? null,
      lng: m.longitude ?? null,
      location: m.location || '',
    }
  } catch (e) {
    toast(e.message)
    router.push('/moments')
  }
})

// 地图选点同步地名输入框；手动改地名也写回选点对象
function onPointChange(v) {
  point.value = v
  locationText.value = v.location || ''
}

async function save() {
  if (busy.value) return
  if (!content.value.trim()) return toast('写点什么吧')
  busy.value = true
  const payload = {
    content: content.value.trim(),
    mood: mood.value,
    location: locationText.value.trim(),
    momentDate: momentDate.value || null,
    longitude: point.value.lat != null ? point.value.lng : null,
    latitude: point.value.lat,
    photos: photos.value.filter((p) => p?.id).map((p) => p.id),
  }
  try {
    if (editingId) await updateMoment(editingId, payload)
    else await createMoment(payload)
    toast(editingId ? '瞬间已更新' : '瞬间已收藏 ✨')
    router.push('/moments')
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
      <span class="text-xs text-white/40 sm:text-right">{{ editingId ? '编辑这条瞬间' : '记录此刻的心情、地点与照片' }}</span>
    </div>
    <h2 class="serif mb-4 text-xl">{{ editingId ? '编辑瞬间' : '记录瞬间' }}</h2>

    <!-- 心情 -->
    <div class="glass mb-4 p-5">
      <label class="mb-2 block text-xs text-white/50">此刻心情</label>
      <div class="flex flex-wrap gap-2">
        <button v-for="m in MOODS" :key="m.key" type="button" @click="mood = m.key"
          class="rounded-full px-3.5 py-1.5 text-sm transition-all"
          :class="mood === m.key ? 'bg-accent-soft ring-1 ring-accent' : 'bg-white/5 hover:bg-white/10'">
          {{ m.emoji }} {{ m.label }}
        </button>
      </div>
    </div>

    <!-- 内容 -->
    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">发生了什么</label>
      <textarea v-model="content" class="input-dark resize-none" rows="5" placeholder="这一刻值得被记住…" />
    </div>

    <!-- 时间与地点 -->
    <div class="glass relative z-20 mb-4 space-y-4 p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-white/50">发生日期（可补记）</label>
          <AppDatePicker v-model="momentDate" placeholder="就是今天" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">地点描述</label>
          <input v-model="locationText" class="input-dark" placeholder="如：西湖边" />
        </div>
      </div>
      <MapPicker :model-value="point" @update:model-value="onPointChange" />
    </div>

    <!-- 照片 -->
    <div class="glass mb-4 p-5">
      <label class="mb-1 block text-xs text-white/50">照片 / 视频（可留空）</label>
      <ImageUpload v-model="photos" accept="all" />
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <button class="btn-ghost w-full sm:w-auto" :disabled="busy" @click="router.push('/moments')">取消</button>
      <button class="btn-primary w-full sm:w-auto" :disabled="busy" @click="save">
        {{ busy ? '保存中…' : (editingId ? '保存修改' : '收藏这个瞬间') }}
      </button>
    </div>
  </div>
</template>
