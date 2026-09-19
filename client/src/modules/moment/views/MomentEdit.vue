<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMoment, createMoment, updateMoment } from '../moment.api.js'
import { listFoods, createFood } from '../../food/food.api.js'
import { toast } from '../../../stores/toast'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'
import ImageUpload from '../../../shared/components/ImageUpload.vue'
import MapPicker from '../components/MapPicker.vue'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'

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
let createKey = null

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

// —— 约会打卡：关联美食店（最多 5 家，可内联新建）——
const MAX_PLACES = 5
const places = ref([])
const foodPickerOpen = ref(false)
const foodKeyword = ref('')
const foodList = ref([])
const foodLoading = ref(false)
const newPlaceName = ref('')
const creatingPlace = ref(false)

const selectedPlaceIds = computed(() => new Set(places.value.map((p) => p.id)))
const filteredFoods = computed(() => {
  const k = foodKeyword.value.trim().toLowerCase()
  return foodList.value
    .filter((f) => !selectedPlaceIds.value.has(f.id))
    .filter((f) => !k || [f.name, f.location, ...(f.dishes || []).map((d) => d.name)].join(' ').toLowerCase().includes(k))
    .slice(0, 20)
})

async function toggleFoodPicker() {
  foodPickerOpen.value = !foodPickerOpen.value
  if (foodPickerOpen.value && !foodList.value.length) {
    foodLoading.value = true
    try { foodList.value = await listFoods() } catch (e) { toast(e.message) } finally { foodLoading.value = false }
  }
}

function addPlace(place) {
  if (places.value.length >= MAX_PLACES) return toast(`一次最多关联 ${MAX_PLACES} 家店`)
  places.value.push({ id: place.id, name: place.name, status: place.status })
}

function removePlace(id) {
  places.value = places.value.filter((p) => p.id !== id)
}

async function createAndAddPlace() {
  const name = newPlaceName.value.trim()
  if (!name || creatingPlace.value) return
  creatingPlace.value = true
  try {
    const place = await createFood({
      name,
      category: 'snack',
      status: 'visited',
      location: locationText.value.trim(),
      longitude: point.value.lat != null ? point.value.lng : null,
      latitude: point.value.lat ?? null,
      visitedAt: momentDate.value || null,
    }, generateIdempotencyKey())
    foodList.value = [place, ...foodList.value]
    addPlace(place)
    newPlaceName.value = ''
    toast('已新建并关联')
  } catch (e) {
    toast(e.message)
  } finally {
    creatingPlace.value = false
  }
}

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
    places.value = (m.places || []).map((p) => ({ id: p.id, name: p.name, status: p.status }))
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
    placeIds: places.value.map((p) => p.id),
  }
  try {
    if (editingId) await updateMoment(editingId, payload)
    else {
      createKey ||= generateIdempotencyKey()
      await createMoment(payload, createKey)
      createKey = null
    }
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

    <!-- 约会打卡：关联美食店 -->
    <div class="glass mb-4 p-5">
      <div class="flex items-center justify-between gap-2">
        <label class="block text-xs text-white/50">这次吃了哪家（可空）</label>
        <button class="shrink-0 text-xs text-accent" @click="toggleFoodPicker">
          {{ foodPickerOpen ? '收起' : '＋ 选择美食' }}
        </button>
      </div>

      <div v-if="places.length" class="mt-2 flex flex-wrap gap-2">
        <span v-for="p in places" :key="p.id"
          class="flex min-h-8 items-center gap-1.5 rounded-full bg-white/5 px-3 text-xs text-white/80">
          🍜 {{ p.name }}
          <button class="text-white/40 hover:text-white" title="取消关联" @click="removePlace(p.id)">×</button>
        </span>
      </div>
      <p v-else class="mt-2 text-[11px] text-white/35">关联后，「想去」的店会自动标记为去过</p>

      <div v-if="foodPickerOpen" class="mt-3 space-y-2">
        <input v-model="foodKeyword" class="input-dark !min-h-10 text-sm" maxlength="40" placeholder="搜店名 / 菜名 / 地点" />
        <div class="max-h-56 space-y-1 overflow-y-auto">
          <button v-for="f in filteredFoods" :key="f.id"
            class="flex w-full items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
            @click="addPlace(f)">
            <span class="min-w-0 truncate">🍜 {{ f.name }}</span>
            <span class="shrink-0 text-[10px] text-white/40">
              {{ f.status === 'want' ? '想去' : f.status === 'favorite' ? '常去' : '去过' }}<template v-if="f.rating"> · {{ f.rating }}★</template>
            </span>
          </button>
          <p v-if="foodLoading" class="py-3 text-center text-xs text-white/40">加载中…</p>
          <p v-else-if="!filteredFoods.length" class="py-3 text-center text-xs text-white/40">没有匹配的店，试试下面新建</p>
        </div>
        <div class="flex items-center gap-2">
          <input v-model="newPlaceName" class="input-dark !min-h-10 min-w-0 flex-1 text-sm" maxlength="40"
            placeholder="没记过？直接建：店名" />
          <button class="btn-ghost !min-h-10 shrink-0 !px-3 text-xs"
            :disabled="creatingPlace || !newPlaceName.trim()" @click="createAndAddPlace">
            {{ creatingPlace ? '新建中…' : '新建并关联' }}
          </button>
        </div>
        <p class="text-[11px] text-white/35">新建会自动带上当前地点与日期</p>
      </div>
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
