<script setup>
// 内容未读小圆点：Ta 新增、我还没打开过该模块列表的内容，在条目上打个玫瑰点。
// 颜色走主题变量 --danger-*，深浅色主题下都能看清。
defineProps({
  show: { type: Boolean, default: false },
  // 可选文案（如「新」）；不传则只显示圆点
  label: { type: String, default: '' },
})
</script>

<template>
  <span v-if="show" class="unread-dot inline-flex shrink-0 items-center gap-1 leading-none" title="Ta 新增，你还没看过">
    <span class="unread-dot__ball" />
    <span v-if="label" class="unread-dot__text">{{ label }}</span>
  </span>
</template>

<style scoped>
.unread-dot__ball {
  height: 0.5rem;
  width: 0.5rem;
  border-radius: 999px;
  background: var(--danger-text);
  box-shadow: 0 0 0 3px rgb(var(--danger-rgb) / 0.18);
}

.unread-dot__text {
  color: var(--danger-text);
  font-size: 0.7rem;
}
</style>
