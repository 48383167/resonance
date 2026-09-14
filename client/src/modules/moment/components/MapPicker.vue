<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { toast } from '../../../stores/toast'
import { currentTheme } from '../../../stores/theme'

// 地图选点组件：点击地图选坐标 + 一键定位；v-model 为 { lat, lng, location }
const props = defineProps({
  modelValue: { type: Object, default: () => ({ lat: null, lng: null, location: '' }) },
})
const emit = defineEmits(['update:modelValue'])

const mapEl = ref(null)
const locating = ref(false)
let map = null
let marker = null
let resizeObserver = null
let reverseSeq = 0
let internalUpdate = false

// 触屏设备单指滚动页面、双指移动缩放地图；桌面保持单指拖拽。
const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false

function emitPatch(patch) {
  internalUpdate = true
  emit('update:modelValue', { ...props.modelValue, ...patch })
  queueMicrotask(() => { internalUpdate = false })
}

function placeMarker(latlng) {
  if (marker) marker.remove()
  marker = L.circleMarker(latlng, { radius: 9, color: currentTheme.primaryColor, fillColor: currentTheme.primaryColor, fillOpacity: 0.8 }).addTo(map)
}

// 编辑页异步回显外部坐标时同步视角与标记；内部点击选中不触发，避免打断用户。
watch(() => [props.modelValue?.lat, props.modelValue?.lng], ([lat, lng]) => {
  if (internalUpdate || lat == null || lng == null || !map) return
  map.setView([lat, lng], Math.max(map.getZoom(), 13))
  placeMarker([lat, lng])
})


watch(() => currentTheme.primaryColor, () => {
  if (marker) placeMarker(marker.getLatLng())
})

// 反向地理编码：坐标 → 具体地名
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-CN`)
    const json = await res.json()
    return json.display_name || ''
  } catch {
    return ''
  }
}

function onMoveEnd() {
  // 地图拖动不改变已选点，仅作视野调整
}

onMounted(() => {
  const v = props.modelValue || {}
  const center = v.lat != null ? [v.lat, v.lng] : [34.5, 108.9]
  map = L.map(mapEl.value, {
    attributionControl: false,
    dragging: !isTouchDevice,
    touchZoom: true,
    scrollWheelZoom: !isTouchDevice,
  }).setView(center, v.lat != null ? 13 : 4)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)
  map.on('click', async (e) => {
    // 先清空旧地名，防止新坐标沿用上一个地点
    emitPatch({ lat: e.latlng.lat, lng: e.latlng.lng, location: '' })
    placeMarker(e.latlng)
    const seq = ++reverseSeq
    const address = await reverseGeocode(e.latlng.lat, e.latlng.lng)
    if (seq === reverseSeq && address) emitPatch({ location: address })
  })
  if (v.lat != null) placeMarker(center)
  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(mapEl.value)
})

onUnmounted(() => {
  reverseSeq += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  if (map) { map.off('click'); map.remove(); map = null; marker = null }
})

async function useMyLocation() {
  if (!navigator.geolocation) return toast('浏览器不支持定位')
  locating.value = true
  const seq = ++reverseSeq
  navigator.geolocation.getCurrentPosition(async (p) => {
    const { latitude, longitude } = p.coords
    const address = await reverseGeocode(latitude, longitude)
    if (seq === reverseSeq) {
      emitPatch({
        lat: latitude,
        lng: longitude,
        location: address || props.modelValue?.location || `纬度 ${latitude.toFixed(4)}, 经度 ${longitude.toFixed(4)}`,
      })
      map.setView([latitude, longitude], 15)
      placeMarker([latitude, longitude])
      toast(address ? '已定位到当前位置' : '已获取坐标（未解析到地名）')
    }
    locating.value = false
  }, () => {
    locating.value = false
    toast('无法获取位置，请检查浏览器定位权限')
  }, { enableHighAccuracy: true, timeout: 8000 })
}
</script>

<template>
  <div>
    <div class="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span class="text-xs text-white/50">地图选点（足迹会画在恋爱地图上）</span>
      <button type="button" class="self-start text-xs text-accent-2 hover:underline disabled:opacity-50 sm:self-auto" :disabled="locating"
        @click="useMyLocation">
        {{ locating ? '定位中…' : '📍 用我的位置' }}
      </button>
    </div>
    <div ref="mapEl" class="h-[42svh] min-h-52 max-h-80 w-full overflow-hidden rounded-xl border border-white/10 sm:h-56" />
    <p class="mt-1 text-xs text-white/40">
      已选坐标：{{ modelValue?.lat != null ? `${modelValue.lat.toFixed(4)}, ${modelValue.lng.toFixed(4)}` : '未选择（点击地图选取）' }}
    </p>
    <p class="mt-0.5 text-[11px] text-white/35">
      <template v-if="isTouchDevice">双指移动 / 缩放地图，单指点击选点 · </template>瓦片 © OpenStreetMap
    </p>
  </div>
</template>
