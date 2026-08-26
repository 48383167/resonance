<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api'
import { currentTheme } from '../stores/theme'

// 恋爱地图：足迹标记 + 轨迹连线 + 统计（Leaflet + OpenStreetMap，免 Key）
const router = useRouter()
const mapEl = ref(null)
const points = ref([])
let map = null
let polyline = null
let overlayLayers = []

const stats = computed(() => {
  const places = new Set(points.value.map((p) => p.location).filter(Boolean))
  return { count: points.value.length, places: places.size }
})

// 有来路时才显示返回按钮（从首页直达时不显示「返回恋爱瞬间」）
const canGoBack = Boolean(history.state?.back)

onMounted(async () => {
  points.value = await api.get('/api/moments/map')
  map = L.map(mapEl.value).setView([34.5, 108.9], 4)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)
  renderMarkers()
})

function renderMarkers() {
  if (!map) return
  overlayLayers.forEach((layer) => layer.remove())
  overlayLayers = []
  if (!points.value.length) return
  const latlngs = []
  for (const p of points.value) {
    const ll = [p.latitude, p.longitude]
    latlngs.push(ll)
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
  polyline = L.polyline(latlngs, { color: currentTheme.secondaryColor, weight: 3, opacity: 0.7, dashArray: '6 8' }).addTo(map)
  overlayLayers.push(polyline)
  map.fitBounds(L.latLngBounds(latlngs).pad(0.3))
}

watch(() => [currentTheme.primaryColor, currentTheme.secondaryColor], renderMarkers)

onUnmounted(() => {
  overlayLayers = []
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">恋爱地图</h2>
        <p class="text-xs text-white/45">带坐标的瞬间会化作足迹，按时间连成轨迹</p>
      </div>
      <button v-if="canGoBack" class="btn-ghost" @click="router.back()">← 返回</button>
    </div>

    <div class="glass flex items-center gap-6 p-4 text-sm">
      <div><b class="text-xl text-accent">{{ stats.count }}</b> <span class="text-white/50">处足迹</span></div>
      <div><b class="text-xl text-accent-2">{{ stats.places }}</b> <span class="text-white/50">个地点</span></div>
      <div class="ml-auto text-xs text-white/40">瓦片 © OpenStreetMap</div>
    </div>

    <div ref="mapEl" class="h-[60vh] w-full overflow-hidden rounded-2xl border border-white/10" />

    <div v-if="!points.length" class="glass p-6 text-center text-sm text-white/50">
      还没有足迹 —— 在「恋爱瞬间」里创建带坐标的记录即可点亮地图
    </div>
  </div>
</template>
