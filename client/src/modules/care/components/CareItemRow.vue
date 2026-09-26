<script setup>
import { computed } from 'vue'
import PinMenu from '../../../shared/components/PinMenu.vue'
import UnreadDot from '../../../shared/components/UnreadDot.vue'
import { highlightParts } from '../../../utils/highlight.js'
import { session } from '../../../stores/session'

// 档案条目行：分组列表与速查结果共用；keyword 命中词高亮
const props = defineProps({
  item: { type: Object, required: true },
  keyword: { type: String, default: '' },
  pinOpen: { type: Boolean, default: false },
  crossLabel: { type: String, default: '' },
})
const emit = defineEmits(['pin', 'edit', 'remove', 'pin-close', 'pin-change'])

const SEVERITY_LABELS = { mild: '轻度', moderate: '中度', severe: '重度' }
const severityClass = (severity) =>
  (severity === 'severe' ? 'danger-link' : severity === 'moderate' ? 'text-accent-2' : 'text-theme-tertiary')

const titleParts = computed(() => highlightParts(props.item.title, props.keyword))
const contentParts = computed(() => highlightParts(props.item.content, props.keyword))
const subjectText = computed(() =>
  props.item.subject?.nickname || (props.item.subject_id === session.userId ? '我' : 'Ta'))
</script>

<template>
  <div :id="`care-item-${item.id}`" class="rounded-xl py-2.5"
    :class="item.pin_scope ? '-mx-1.5 bg-accent-soft px-1.5' : ''">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <UnreadDot :show="Boolean(item.is_unread)" label="新" />
          <h4 class="text-sm font-medium">
            <template v-for="(part, i) in titleParts" :key="i"><mark v-if="part.hit"
              class="bg-accent-soft text-accent rounded-sm px-0.5">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
          </h4>
          <span v-if="item.severity" class="text-[11px]" :class="severityClass(item.severity)">
            {{ SEVERITY_LABELS[item.severity] }}
          </span>
          <span v-if="crossLabel" class="text-[11px] text-theme-tertiary">{{ crossLabel }}</span>
          <span v-if="item.pin_scope" class="text-[11px] text-accent" title="已置顶">📌</span>
        </div>
        <p v-if="item.content" class="mt-1 whitespace-pre-wrap text-xs leading-5 text-theme-secondary">
          <template v-for="(part, i) in contentParts" :key="i"><mark v-if="part.hit"
            class="bg-accent-soft text-accent rounded-sm px-0.5">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
        </p>
        <p class="mt-1 text-[11px] text-theme-tertiary">
          {{ item.author?.nickname || '我' }} 记录 · 关于 {{ subjectText }}
        </p>
      </div>

      <div class="flex shrink-0 items-center">
        <button class="min-h-9 min-w-9 text-xs transition-colors"
          :class="pinOpen ? 'text-accent' : 'text-theme-tertiary hover:text-accent'"
          title="设置置顶" @click="emit('pin')">📌</button>
        <button class="min-h-9 min-w-9 text-xs text-theme-tertiary transition-colors hover:text-theme-primary"
          title="编辑" @click="emit('edit')">✎</button>
        <button class="min-h-9 min-w-9 text-xs danger-link" title="删除" @click="emit('remove')">×</button>
      </div>
    </div>

    <PinMenu v-if="pinOpen" target-type="care" :target-id="item.id"
      :scope="item.pin_scope || 'none'" @close="emit('pin-close')" @change="emit('pin-change')" />
  </div>
</template>
