<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDiary, removeDiary, setVisibility } from '../diary.api.js'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { paletteFor, weatherLabel } from '../../../composables/useAmbient'
import { confirmDialog } from '../../../stores/confirm'
import { openLightbox } from '../../../stores/lightbox'
import { mediaTypeOf } from '../../../utils/media'
import EmotionText from '../components/EmotionText.vue'
import AmbientBackground from '../../../shared/components/AmbientBackground.vue'

const route = useRoute()
const router = useRouter()
const entry = ref(null)

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/diary-list')
}

async function load() {
  entry.value = await getDiary(route.params.id)
}
onMounted(load)

async function remove() {
  const ok = await confirmDialog({ title: '删除日记', message: '确定删除这篇日记吗？删除后无法恢复。' })
  if (!ok) return
  await removeDiary(entry.value.id)
  toast('日记已删除')
  goBack()
}

const dateText = computed(() => {
  if (!entry.value) return ''
  const d = new Date(entry.value.created_at)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
})
const timeText = computed(() => {
  if (!entry.value) return ''
  const d = new Date(entry.value.created_at)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})

const publicStatus = computed(() => (entry.value?.is_public ? '公开' : '私密'))
async function togglePublic() {
  const isPublic = !entry.value.is_public
  const msg = isPublic ? '将此日记公开到观测台？其他人也能看到。' : '将此日记设为私密？'
  const ok = await confirmDialog({ title: '确认操作', message: msg, danger: false })
  if (!ok) return
  entry.value = await setVisibility(entry.value.id, isPublic)
  toast(isPublic ? '日记已公开' : '日记已设为私密')
}

const hour = computed(() => (entry.value ? new Date(entry.value.created_at).getHours() : 12))
const palette = computed(() => (entry.value ? paletteFor(hour.value, entry.value.weather_code) : ['#0b1d3a']))
const fgColor = computed(() => entry.value?.time_color_hex || palette.value[1] || '#d8a7ff')

const imageMedia = computed(() => (entry.value?.media || []).filter((u) => (u.type || mediaTypeOf(u.url || '')) === 'image'))

// 正文分片：把 user_id 映射成昵称，供渲染
const named = computed(() => (entry.value?.contents || []).map((c) => ({
  ...c,
  nickname: c.user_id === session.userId ? session.me?.nickname : (session.partner?.nickname || 'Ta'),
})))
</script>

<template>
  <div class="fade-up">
    <div class="mb-4 flex items-center justify-between">
      <button class="btn-ghost text-sm" @click="goBack">← 返回</button>
      <div v-if="entry" class="flex gap-2">
        <button class="btn-ghost text-sm" @click="togglePublic">{{ entry.is_public ? '🔭 设为私密' : '🔒 公开' }}</button>
      </div>
    </div>

    <div v-if="!entry" class="py-20 text-center text-white/40">加载中…</div>
    <div v-else class="glass relative overflow-hidden p-6 sm:p-10">
      <AmbientBackground :colors="palette" :weather-code="entry.weather_code" :opacity="0.35" />
      
      <div class="relative z-10 text-center">
        <div class="text-[10px] text-white/40">{{ dateText }}</div>
        <div class="serif mt-1 text-2xl" :style="{ color: fgColor }">{{ timeText }}</div>
        <h1 class="serif mt-4 text-3xl font-bold">{{ entry.title || '无题' }}</h1>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span v-if="entry.weather_code != null" class="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
            {{ weatherLabel(entry.weather_code) }}
          </span>
          <span class="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/50">{{ publicStatus }}</span>
        </div>
      </div>

      <div class="relative z-10 mt-10 space-y-6">
        <div v-for="c in named" :key="c.id" class="border-l-2 pl-4" :style="{ borderColor: fgColor + '60' }">
          <div class="flex items-center gap-2 text-xs text-white/40">
            <span>{{ c.nickname }}</span>
            <span v-if="c.typing_speed" title="打字速度 (WPM)">⚡{{ c.typing_speed }}</span>
            <span v-if="c.delete_count" title="删改次数">🗑️{{ c.delete_count }}</span>
          </div>
          <EmotionText :content="c.content"
            :metrics="{ wpm: c.typing_speed, backspaceCount: c.delete_count, pauseDuration: c.pause_duration }" />
        </div>
      </div>

      <div v-if="entry.media?.length" class="mt-6 space-y-3 border-t border-white/10 pt-5">
        <div v-if="imageMedia.length" class="flex flex-wrap gap-2">
          <img v-for="(u, i) in imageMedia" :key="u.id || u.url || i" :src="u.url" class="h-24 w-24 cursor-zoom-in rounded-lg object-cover"
            loading="lazy" @click="openLightbox(imageMedia.map((x) => x.url), i)" />
        </div>
        <video v-for="(u, i) in entry.media.filter((x) => (x.type || mediaTypeOf(x.url || '')) === 'video')" :key="u.id || u.url || i" :src="u.url"
          class="max-h-72 w-full rounded-xl" controls />
        <a v-for="(u, i) in entry.media.filter((x) => (x.type || mediaTypeOf(x.url || '')) === 'file')" :key="u.id || u.url || i" :href="u.url" target="_blank"
          class="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-accent-2 hover:bg-white/10">
          📄 {{ u.name || decodeURIComponent((u.url || '').split('/').pop()) }}
        </a>
      </div>

      <div class="mt-8 flex justify-center">
        <button class="rounded-full border border-rose-400/30 px-4 py-1.5 text-xs text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-300"
          @click="remove">🗑 删除这篇日记</button>
      </div>
    </div>
  </div>
</template>
