<script setup>
import AppModal from './AppModal.vue'
import { setPin } from '../../modules/pin/pin.api.js'
import { loadGlobalPins } from '../../stores/pins'
import { toast } from '../../stores/toast'

// 置顶级别选择：不置顶 / 列表置顶 / 全站置顶
const props = defineProps({
  open: { type: Boolean, default: false },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  scope: { type: String, default: 'none' },
})
const emit = defineEmits(['close', 'change'])

const CHOICES = [
  { value: 'none', label: '不置顶', help: '恢复普通排序' },
  { value: 'list', label: '列表置顶', help: '排在自己列表最前' },
  { value: 'global', label: '全站置顶', help: '首页与全站横幅展示' },
]

async function choose(scope) {
  try {
    await setPin({ targetType: props.targetType, targetId: props.targetId, scope })
    loadGlobalPins()
    emit('change', scope)
    emit('close')
  } catch (e) {
    toast(e.message)
  }
}
</script>

<template>
  <AppModal :open="open" title="设置置顶" width="max-w-sm" @close="emit('close')">
    <div class="space-y-2">
      <button v-for="choice in CHOICES" :key="choice.value"
        class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-accent-soft"
        :class="choice.value === scope ? 'bg-accent-soft text-accent' : 'text-theme-primary'"
        @click="choose(choice.value)">
        <span class="font-medium">{{ choice.label }}</span>
        <span class="shrink-0 text-xs text-theme-tertiary">{{ choice.help }}</span>
      </button>
    </div>
  </AppModal>
</template>
