<script setup>
import { computed } from 'vue'
import { weatherLabel } from '../../../composables/useAmbient'
import CommentCountBadge from '../../../shared/components/CommentCountBadge.vue'

// 日记卡片：手机端紧凑行卡（标题单行 + 摘要单行），桌面恢复舒适样式
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
  <div class="glass group cursor-pointer p-3.5 transition-all hover:bg-white/10 sm:p-5"
    @click="emit('open', entry.id)">
    <div class="flex items-start justify-between gap-3">
      <h3 class="serif min-w-0 flex-1 truncate text-base font-medium sm:whitespace-normal sm:break-words sm:text-lg sm:font-semibold">
        {{ entry.title || '无题日记' }}
      </h3>
      <div class="flex shrink-0 items-center gap-2">
        <CommentCountBadge :count="entry.comment_count" :unread="entry.unread_comment_count" />
        <button class="text-sm transition-opacity hover:opacity-70"
          :title="entry.is_public ? '公开中（观测台可见）' : '私密'"
          @click.stop="emit('toggle-public', entry)">
          {{ entry.is_public ? '🔭' : '🔒' }}
        </button>
      </div>
    </div>
    <p v-if="snippet" class="mt-1 line-clamp-1 break-words text-sm text-white/60 sm:mt-2 sm:line-clamp-2">{{ snippet }}</p>
    <div class="mt-1.5 flex items-center gap-2 text-xs text-white/35 sm:mt-3">
      <span>{{ dateText }}</span>
      <span v-if="entry.weather_code != null">{{ weatherLabel(entry.weather_code) }}</span>
    </div>
  </div>
</template>
