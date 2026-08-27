<script setup>
import { computed } from 'vue'
import { weatherLabel } from '../../../composables/useAmbient'

// 时间轴卡片（日记）
const props = defineProps({
  entry: { type: Object, required: true },
})

const emit = defineEmits(['open', 'toggle-public'])

const snippet = computed(() => {
  const first = props.entry.contents?.find((c) => c.content)?.content || ''
  return first.length > 60 ? first.slice(0, 60) + '…' : first
})
const dateText = computed(() => new Date(props.entry.created_at).toLocaleString('zh-CN', {
  month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
}))
</script>

<template>
  <div class="glass group cursor-pointer p-5 transition-all hover:bg-white/10"
    @click="emit('open', entry.id)">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-accent-2-soft px-2.5 py-0.5 text-xs text-accent-2">日记</span>
        <span v-if="entry.weather_code != null" class="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
          {{ weatherLabel(entry.weather_code) }}
        </span>
      </div>
      <button class="rounded-full px-2 py-1 text-sm transition-opacity hover:opacity-70"
        :title="entry.is_public ? '公开中（观测台可见）' : '私密'"
        @click.stop="emit('toggle-public', entry)">
        {{ entry.is_public ? '🔭' : '🔒' }}
      </button>
    </div>
    <h3 class="serif mt-3 break-words text-lg font-semibold">{{ entry.title || '无题日记' }}</h3>
    <p v-if="snippet" class="mt-2 break-words text-sm text-white/60">{{ snippet }}</p>
    <div class="mt-3 text-xs text-white/35">{{ dateText }}</div>
  </div>
</template>
