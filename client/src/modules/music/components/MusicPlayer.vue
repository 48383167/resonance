<script setup>
import { ref, computed, onMounted } from 'vue'
import { musicState, restoreMusic, toggleMusic, nextTrack, previousTrack } from '../../../stores/music'

// 全局甜蜜背景音乐：右下角悬浮迷你播放器（网易云随机音乐）
const expanded = ref(false)

const current = computed(() => musicState.tracks[musicState.index] || null)
const playing = computed(() => musicState.playing)
const loading = computed(() => musicState.loading)

async function toggle() {
  const wasPlaying = musicState.playing
  const started = await toggleMusic()
  if (!wasPlaying && started) expanded.value = true
}

async function next() {
  await nextTrack()
}

async function prev() {
  await previousTrack()
}

function close() {
  expanded.value = false
}

onMounted(restoreMusic)
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
