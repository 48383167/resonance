<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { listTracks } from '../music.api.js'
import { toast } from '../../../stores/toast'

// 全局甜蜜背景音乐：右下角悬浮迷你播放器（网易云随机音乐）
const tracks = ref([])
const index = ref(0)
const playing = ref(false)
const expanded = ref(false)
const loading = ref(false)
let audio = null

const current = computed(() => tracks.value[index.value] || null)

function ensureAudio() {
  if (!audio) {
    audio = new Audio()
    audio.volume = 0.5
    audio.addEventListener('ended', next)
  }
  return audio
}

async function load() {
  if (tracks.value.length) return
  await loadRandom()
}

async function loadRandom() {
  loading.value = true
  try {
    const nextTracks = await listTracks()
    if (nextTracks.length) {
      tracks.value = [...tracks.value, nextTracks[0]]
      index.value = tracks.value.length - 1
    }
  } catch (e) {
    toast(e.message)
  } finally {
    loading.value = false
  }
}

function playCurrent() {
  if (!current.value) return
  const a = ensureAudio()
  a.src = current.value.audio
  a.play().catch(() => {})
  playing.value = true
}

async function toggle() {
  if (loading.value) return
  if (!tracks.value.length) {
    await load()
    if (!tracks.value.length) return
  }
  if (playing.value) {
    audio?.pause()
    playing.value = false
  } else {
    playCurrent()
    expanded.value = true
  }
}

async function next() {
  if (!tracks.value.length) return
  if (index.value < tracks.value.length - 1) {
    index.value += 1
    if (playing.value) playCurrent()
    return
  }
  await loadRandom()
  if (playing.value && current.value) playCurrent()
}

function prev() {
  if (!tracks.value.length) return
  index.value = (index.value - 1 + tracks.value.length) % tracks.value.length
  if (playing.value) playCurrent()
}

function close() {
  expanded.value = false
}

onUnmounted(() => {
  if (audio) {
    audio.pause()
    audio = null
  }
})
</script>

<template>
  <div class="music-player fixed bottom-6 right-4 z-40 flex flex-col items-end">
    <!-- 迷你播放卡片 -->
    <Transition name="mp">
      <div v-if="expanded && current" class="glass mb-3 w-64 p-4">
        <div class="flex items-start gap-3">
          <img :src="current.image" class="h-12 w-12 shrink-0 rounded-lg object-cover" alt="" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium" :title="current.name">{{ current.name }}</p>
            <p class="truncate text-xs text-white/45">{{ current.artist }}</p>
          </div>
          <button class="text-xs text-white/40 hover:text-white" @click="close">✕</button>
        </div>
        <div class="mt-3 flex items-center justify-center gap-4">
          <button class="text-lg text-white/70 transition-colors hover:text-white" title="上一首" @click="prev">⏮</button>
          <button class="flex h-10 w-10 items-center justify-center rounded-full text-sm transition-transform hover:scale-105"
            style="background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: var(--accent-contrast)" @click="toggle">
            {{ playing ? '⏸' : '▶' }}
          </button>
          <button class="text-lg text-white/70 transition-colors hover:text-white" title="下一首" @click="next">⏭</button>
        </div>
      </div>
    </Transition>

    <!-- 悬浮按钮 -->
    <button class="flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-lg transition-transform hover:scale-110"
      :class="playing ? 'opacity-100' : 'opacity-80'"
      style="background: linear-gradient(135deg, var(--accent), var(--accent-2)); box-shadow: 0 6px 24px rgb(var(--accent-rgb) / 0.4)"
      :title="playing ? '暂停背景音乐' : '播放甜蜜背景音乐'" @click="toggle">
      {{ loading ? '…' : (playing ? '🎵' : '♪') }}
    </button>
  </div>
</template>

<style scoped>
.mp-enter-active, .mp-leave-active { transition: all 0.25s ease; }
.mp-enter-from, .mp-leave-to { opacity: 0; transform: translateY(8px); }

@media (max-width: 640px) {
  .music-player {
    bottom: calc(4.75rem + env(safe-area-inset-bottom));
    right: 0.75rem;
  }
}
</style>
