<script setup>
// 评论计数徽标：未读时高亮并显示未读数
defineProps({
  count: { type: Number, default: 0 },
  unread: { type: Number, default: 0 },
})
</script>

<template>
  <span v-if="count" class="inline-flex items-center gap-1 text-[11px] leading-none"
    :class="unread ? 'text-rose-300' : 'text-theme-tertiary'">
    <span>💬 {{ count }}</span>
    <span v-if="unread" class="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium">{{ unread }} 未读</span>
  </span>
</template>
