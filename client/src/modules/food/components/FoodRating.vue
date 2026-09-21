<script setup>
// 星级评分：点同一颗星可清除（1~5 星）；只读模式仅展示
const props = defineProps({
  modelValue: { type: Number, default: null },
  readonly: { type: Boolean, default: false },
  dense: { type: Boolean, default: false }, // 紧凑行内场景（菜品行）：不显示「N 星」文字
})
const emit = defineEmits(['update:modelValue'])

const STARS = [1, 2, 3, 4, 5]

function pick(n) {
  if (props.readonly) return
  emit('update:modelValue', props.modelValue === n ? null : n)
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <button v-for="n in STARS" :key="n" type="button" :disabled="readonly" :aria-label="`${n} 星`"
      class="leading-none transition touch-manipulation"
      :class="[
        readonly
          ? 'cursor-default text-base'
          : ['text-lg hover:text-accent active:scale-110', dense ? 'min-h-9 min-w-7' : 'min-h-9 min-w-8'],
        n <= (modelValue || 0) ? 'text-accent' : 'text-theme-tertiary opacity-30',
      ]"
      @click="pick(n)">★</button>
    <span v-if="modelValue && !readonly && !dense" class="ml-1 text-[11px] text-theme-tertiary">{{ modelValue }} 星</span>
    <span v-else-if="readonly && !modelValue" class="text-[11px] text-theme-tertiary opacity-60">未评分</span>
  </div>
</template>
