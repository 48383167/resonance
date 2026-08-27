<script setup>
import { computed, onMounted, ref } from 'vue'
import { getObservatory } from '../observatory.api.js'
import { paletteFor, weatherLabel } from '../../../composables/useAmbient'
import EmotionText from '../../diary/components/EmotionText.vue'

// 观测台：对外展示页（无需配对，展示精选的高光时刻）
const props = defineProps({
  initialData: { type: Object, default: null },
})
const entries = ref([])

async function load() {
  if (props.initialData) {
    entries.value = props.initialData.entries || []
    return
  }
  const data = await getObservatory()
  entries.value = data.entries
}
onMounted(load)

const cardPalette = (e) => paletteFor(new Date(e.created_at).getHours(), e.weather_code)
const dateText = (e) => new Date(e.created_at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
</script>

<template>
  <div class="fade-up">
    <header class="py-6 text-center">
      <div class="text-3xl">🔭</div>
      <h1 class="serif mt-3 text-2xl font-bold tracking-[0.3em]">观测台</h1>
      <p class="mt-2 text-sm text-white/55">把想分享的日常，留给星光收藏</p>
    </header>

    <div v-if="!entries.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">🌌</div>
      <p class="mt-3">这里还没有公开的日记，等一段愿意被看见的心事。</p>
    </div>

    <div class="grid gap-5">
      <article v-for="(e, i) in entries" :key="e.id" class="glass fade-up overflow-hidden"
        :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }">
        <!-- 环境底片头图 -->
        <div class="h-20" :style="{
          background: `linear-gradient(120deg, ${cardPalette(e)[0]}, ${cardPalette(e)[1]} 60%, ${cardPalette(e)[2]})`,
        }" />
        <div class="p-5">
          <div class="flex items-center gap-2 text-xs text-white/50">
            <span>{{ dateText(e) }}</span>
            <span v-if="e.weather_code != null">· ☁ {{ weatherLabel(e.weather_code) }}</span>
          </div>
          <h2 class="serif mt-3 text-xl font-semibold">{{ e.title || '无题日记' }}</h2>
          <div class="mt-4 grid gap-4">
            <div v-for="c in e.contents" :key="c.id">
              <EmotionText :content="c.content" compact
                :metrics="{ wpm: c.typing_speed, backspaceCount: c.delete_count, pauseDuration: c.pause_duration }" />
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
