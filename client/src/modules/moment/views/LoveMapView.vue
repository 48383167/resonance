<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapMoments } from '../moment.api.js'
import { getFoodMap } from '../../food/food.api.js'
import { currentTheme } from '../../../stores/theme'

// 恋爱地图：足迹标记 + 轨迹连线 + 美食图层（Leaflet + OpenStreetMap，免 Key）
const router = useRouter()
const mapEl = ref(null)
const moments = ref([])
const foods = ref([])
const layer = ref('all') // all 全部 / moment 足迹 / food 美食
let map = null
let overlayLayers = []

const LAYERS = [
  { value: 'all', label: '全部' },
  { value: 'moment', label: '足迹' },
  { value: 'food', label: '美食' },
]

const showMoments = computed(() => layer.value !== 'food')
const showFoods = computed(() => layer.value !== 'moment')

const stats = computed(() => {
  const places = new Set(moments.value.map((p) => p.location).filter(Boolean))
  return {
    count: showMoments.value ? moments.value.length : 0,
    places: showMoments.value ? places.size : 0,
    foods: showFoods.value ? foods.value.length : 0,
  }
})

// 有来路时才显示返回按钮（从首页直达时不显示「返回恋爱瞬间」）
const canGoBack = Boolean(history.state?.back)

onMounted(async () => {
  const [momentList, foodList] = await Promise.all([
    mapMoments().catch(() => []),
    getFoodMap().catch(() => []),
  ])
  moments.value = momentList
  foods.value = foodList
  map = L.map(mapEl.value).setView([34.5, 108.9], 4)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)
  renderMarkers()
})

const topDishOf = (food) => food.dishes?.[0]?.name || ''

function renderMarkers() {
  if (!map) return
  overlayLayers.forEach((l) => l.remove())
  overlayLayers = []
  const allLatLngs = []

  if (showMoments.value && moments.value.length) {
    const latlngs = []
    for (const p of moments.value) {
      const ll = [p.latitude, p.longitude]
      latlngs.push(ll)
      allLatLngs.push(ll)
      const popup = `
        <div style="color:#1a1030;max-width:220px">
          <b>${p.author?.nickname || 'Ta'} · ${p.moment_date || p.created_at.slice(0, 10)}</b>
          <p style="margin:4px 0 0">${p.content.length > 60 ? p.content.slice(0, 60) + '…' : p.content}</p>
        </div>`
      const marker = L.circleMarker(ll, {
        radius: 8,
        color: currentTheme.primaryColor,
        weight: 2,
        fillColor: currentTheme.secondaryColor,
        fillOpacity: 0.9,
      }).addTo(map).bindPopup(popup)
      overlayLayers.push(marker)
    }
    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, { color: currentTheme.secondaryColor, weight: 3, opacity: 0.7, dashArray: '6 8' }).addTo(map)
      overlayLayers.push(polyline)
    }
  }

  if (showFoods.value && foods.value.length) {
    for (const f of foods.value) {
      const ll = [f.latitude, f.longitude]
      allLatLngs.push(ll)
      const dish = topDishOf(f)
      const popup = `
        <div style="color:#1a1030;max-width:220px">
          <b>🍜 ${f.name}</b>
          <p style="margin:4px 0 0">${dish ? `招牌：${dish}` : ''}${f.rating ? `${dish ? ' · ' : ''}${f.rating}★` : ''}</p>
          ${f.location ? `<p style="margin:4px 0 0;opacity:.7">${f.location}</p>` : ''}
          <a data-food-link="${f.id}" style="display:inline-block;margin-top:6px;color:#4a7cff;cursor:pointer">查看详情 →</a>
        </div>`
      const marker = L.circleMarker(ll, {
        radius: 7,
        color: '#f08c2e',
        weight: 2,
        fillColor: '#ffd166',
        fillOpacity: 0.95,
      }).addTo(map).bindPopup(popup)
      marker.on('popupopen', (event) => {
        const link = event.popup.getElement()?.querySelector(`[data-food-link="${f.id}"]`)
        link?.addEventListener('click', () => router.push(`/foods/${f.id}`))
      })
      overlayLayers.push(marker)
    }
  }

  if (allLatLngs.length) map.fitBounds(L.latLngBounds(allLatLngs).pad(0.3))
}

watch(() => [currentTheme.primaryColor, currentTheme.secondaryColor], renderMarkers)
watch(layer, renderMarkers)

onUnmounted(() => {
  overlayLayers = []
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="serif text-xl">恋爱地图</h2>
        <p class="text-xs text-white/45">足迹连成轨迹，美食点亮小店</p>
      </div>
      <button v-if="canGoBack" class="btn-ghost" @click="router.back()">← 返回</button>
    </div>

    <div class="flex gap-2">
      <button v-for="l in LAYERS" :key="l.value"
        class="min-h-10 rounded-full px-4 text-sm transition-colors"
        :class="layer === l.value ? 'bg-accent-soft text-accent' : 'bg-white/5 text-white/60 hover:bg-white/10'"
        @click="layer = l.value">
        {{ l.label }}
      </button>
    </div>

    <div class="glass flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
      <div><b class="text-xl text-accent">{{ stats.count }}</b> <span class="text-white/50">处足迹</span></div>
      <div><b class="text-xl text-accent-2">{{ stats.places }}</b> <span class="text-white/50">个地点</span></div>
      <div><b class="text-xl text-amber-300">{{ stats.foods }}</b> <span class="text-white/50">家美食</span></div>
      <div class="basis-full text-xs text-white/40 sm:ml-auto sm:basis-auto">瓦片 © OpenStreetMap</div>
    </div>

    <div ref="mapEl" class="h-[55svh] min-h-64 max-h-[38rem] w-full overflow-hidden rounded-2xl border border-white/10 sm:h-[60vh]" />

    <div v-if="!moments.length && !foods.length" class="glass p-6 text-center text-sm text-white/50">
      地图还空着 —— 在「恋爱瞬间」记录足迹，或在「美食」里记一家店并在地图上点选位置
    </div>
    <div v-else-if="layer === 'moment' && !moments.length" class="glass p-6 text-center text-sm text-white/50">
      还没有足迹 —— 在「恋爱瞬间」里创建带坐标的记录即可点亮地图
    </div>
    <div v-else-if="layer === 'food' && !foods.length" class="glass p-6 text-center text-sm text-white/50">
      还没有带坐标的美食 —— 在「美食」里记一家店并在地图上点选位置吧
    </div>
  </div>
</template>
