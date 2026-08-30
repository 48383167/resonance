<script setup>
import { computed, onMounted, ref } from 'vue'
import { getInternalObservatory, setObservatoryVisibility } from '../observatory.api.js'
import { toast } from '../../../stores/toast'
import ObservatoryPhotoRain from './ObservatoryPhotoRain.vue'

// 观测台只展示情侣主动选中的真实相册照片。
const props = defineProps({
  initialData: { type: Object, default: null },
})
const photos = ref([])
const enabled = ref(true)
const busy = ref(false)
const isInternal = computed(() => !props.initialData)

async function load() {
  if (props.initialData) {
    enabled.value = props.initialData.enabled !== false
    photos.value = props.initialData.photos || []
    return
  }

  try {
    const data = await getInternalObservatory()
    photos.value = data.photos || []
    enabled.value = data.enabled !== false
  } catch (error) {
    toast(error.message || '观测台加载失败', 'error')
  }
}

async function toggleVisibility() {
  if (busy.value) return

  const nextValue = !enabled.value
  busy.value = true
  try {
    const data = await setObservatoryVisibility(nextValue)
    enabled.value = typeof data?.enabled === 'boolean' ? data.enabled : nextValue
    toast(enabled.value ? '观测台已对外展示' : '观测台已关闭')
  } catch (error) {
    toast(error.message || '观测台状态更新失败', 'error')
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="fade-up">
    <header class="flex flex-col items-center gap-4 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <div class="text-3xl">🔭</div>
        <h1 class="serif mt-3 text-2xl font-bold tracking-[0.3em]">观测台</h1>
        <p class="mt-2 text-sm text-white/55">把相册里的光，留给星光收藏</p>
      </div>
      <button
        v-if="isInternal"
        type="button"
        role="switch"
        :aria-checked="enabled"
        :aria-label="enabled ? '关闭观测台对外展示' : '开启观测台对外展示'"
        :aria-busy="busy"
        :disabled="busy"
        class="group flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left shadow-lg shadow-black/10 backdrop-blur transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-65 sm:w-auto sm:min-w-52"
        @click="toggleVisibility"
      >
        <span>
          <span class="block text-xs text-white/55">观测台总展示</span>
          <span class="mt-0.5 block text-sm font-semibold text-white/90">{{ busy ? '正在保存…' : enabled ? '对外展示' : '已关闭' }}</span>
        </span>
        <span
          class="relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors"
          :class="enabled ? 'bg-[rgb(var(--accent-rgb)/0.9)]' : 'bg-white/20'"
        >
          <span class="block h-5 w-5 rounded-full bg-white shadow-md transition-transform" :class="enabled ? 'translate-x-5' : ''" />
        </span>
      </button>
    </header>

    <p v-if="isInternal" class="mb-4 text-center text-xs text-white/45 sm:text-right">
      关闭后，未登录访客打开默认入口会进入登录页。
    </p>

    <div v-if="!photos.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">🌌</div>
      <p class="mt-3">这里还没有被星光收藏的照片。</p>
    </div>
    <ObservatoryPhotoRain v-else :photos="photos" />
  </div>
</template>
