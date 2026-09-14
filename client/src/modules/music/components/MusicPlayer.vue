<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { musicState, restoreMusic, toggleMusic, nextTrack, previousTrack, loadRandomTrack } from '../../../stores/music'
import { toast } from '../../../stores/toast'

// 全局甜蜜背景音乐：右下角悬浮迷你播放器（网易云随机音乐）
const route = useRoute()
const expanded = ref(false)
const rootEl = ref(null)

const current = computed(() => musicState.tracks[musicState.index] || null)
const playing = computed(() => musicState.playing)
const loading = computed(() => musicState.loading)
const isCompanion = computed(() => route.name === 'companion')

async function toggle() {
  const wasPlaying = musicState.playing
  const started = await toggleMusic()
  if (!wasPlaying && started) expanded.value = true
  else if (!wasPlaying && !started && !musicState.loading) toast('播放失败，请再点一次播放')
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

// 展开面板时点外部关闭
function onDocPointerDown(event) {
  if (expanded.value && rootEl.value && !rootEl.value.contains(event.target)) expanded.value = false
}

onMounted(() => {
  restoreMusic()
  // 提前取好曲库，保证手机上首次点播放仍在用户手势内触发 play()
  if (!current.value) loadRandomTrack()
  document.addEventListener('pointerdown', onDocPointerDown)
})

onUnmounted(() => document.removeEventListener('pointerdown', onDocPointerDown))
</script>

<template>
  <div ref="rootEl" class="music-player fixed bottom-6 right-4 z-40 flex select-none flex-col items-end"
    :class="{ 'music-player--companion': isCompanion }">
    <!-- 迷你播放卡片 -->
    <Transition name="mp">
      <div v-if="expanded && current" class="glass mb-3 w-64 p-4">
        <div class="flex items-start gap-3">
          <img :src="current.image" class="h-12 w-12 shrink-0 rounded-lg object-cover" alt="" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium" :title="current.name">{{ current.name }}</p>
            <p class="truncate text-xs text-white/45">{{ current.artist }}</p>
          </div>
          <button class="flex h-11 w-11 -mr-2 -mt-1 items-center justify-center rounded-full text-sm text-white/40 transition-colors hover:bg-white/10 hover:text-white" aria-label="收起播放器" @click="close">✕</button>
        </div>
        <div class="mt-1 flex items-center justify-center gap-2">
          <button class="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="上一首" aria-label="上一首" @click="prev">⏮</button>
          <button class="flex h-11 w-11 items-center justify-center rounded-full text-sm transition-transform hover:scale-105"
            style="background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: var(--accent-contrast)" aria-label="播放或暂停" @click="toggle">
            {{ playing ? '⏸' : '▶' }}
          </button>
          <button class="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="下一首" aria-label="下一首" @click="next">⏭</button>
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
    right: max(0.75rem, env(safe-area-inset-right));
  }
}

/* 心语陪伴全屏聊天时隐藏悬浮播放器，避免遮挡输入条 */
@media (max-width: 767px) {
  .music-player--companion { display: none; }
}
</style>
