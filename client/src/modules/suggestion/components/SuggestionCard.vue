<script setup>
import { computed, onMounted, ref } from 'vue'
import { analyzeSuggestions } from '../suggestion.api.js'

// AI 整理建议卡片（档案 / 规矩共用）：
//   - 开关关闭后不分析、不显示、零出站
//   - 结果按情侣空间共享；单条可忽略（本地记录，不再出现）
//   - 建议仅供参考，处理动作由用户点击完成，绝不自动修改数据
const props = defineProps({
  target: { type: String, required: true }, // care | rule
})
const emit = defineEmits(['open'])

const ENABLED_KEY = 'resonance.aiSuggestions'
const DISMISS_KEY = 'resonance.aiSuggestions.dismissed'

const enabled = ref(localStorage.getItem(ENABLED_KEY) !== '0')
const loading = ref(false)
const error = ref('')
const data = ref(null)

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')) } catch { return new Set() }
}
const dismissed = ref(loadDismissed())

function saveDismissed() {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed.value].slice(-100))) } catch { /* 隐私模式下忽略 */ }
}

const dismissKey = (s) => `${props.target}|${s.reason}`
const visible = computed(() => (data.value?.suggestions || []).filter((s) => !dismissed.value.has(dismissKey(s))))
const hidden = computed(() => Boolean(data.value?.empty) && !visible.value.length)

function dismiss(s) {
  dismissed.value.add(dismissKey(s))
  saveDismissed()
}

function setEnabled(value) {
  enabled.value = value
  try { localStorage.setItem(ENABLED_KEY, value ? '1' : '0') } catch { /* 忽略 */ }
  if (value) refresh()
}

async function refresh() {
  if (!enabled.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await analyzeSuggestions(props.target)
  } catch (e) {
    error.value = e.message || 'AI 暂时不可用'
  } finally {
    loading.value = false
  }
}

function timeText(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff) || diff < 0) return ''
  const minute = 60_000
  if (diff < minute) return '刚刚分析'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前分析`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前分析`
  return `${Math.floor(diff / (24 * 60 * minute))} 天前分析`
}

onMounted(() => { if (enabled.value) refresh() })
</script>

<template>
  <template v-if="!hidden">
    <div v-if="!enabled" class="flex items-center justify-center gap-1.5 text-[11px] text-theme-tertiary">
      <span>💡 AI 整理建议已关闭</span>
      <button class="underline transition-colors hover:text-accent" @click="setEnabled(true)">开启</button>
    </div>

    <div v-else class="glass rounded-2xl p-4">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-theme-secondary">
          💡 AI 整理建议
          <span v-if="!loading && !error && visible.length" class="text-theme-tertiary">（{{ visible.length }} 条）</span>
        </p>
        <div class="flex shrink-0 items-center gap-2 text-[11px] text-theme-tertiary">
          <button v-if="!loading" class="transition-colors hover:text-accent" @click="refresh">重新分析</button>
          <button class="transition-colors hover:text-accent" @click="setEnabled(false)">关闭</button>
        </div>
      </div>

      <div v-if="loading" class="mt-3 space-y-2">
        <div class="surface-soft h-8 animate-pulse rounded-xl" />
        <div class="surface-soft h-8 w-2/3 animate-pulse rounded-xl" />
      </div>

      <p v-else-if="error" class="mt-2 text-xs text-theme-tertiary">{{ error }}</p>

      <template v-else>
        <p v-if="!visible.length" class="mt-2 text-xs text-theme-tertiary">暂时没有发现需要整理的地方 ✨</p>

        <ul v-else class="mt-2 space-y-2">
          <li v-for="s in visible" :key="s.id" class="flex items-start gap-2 rounded-xl px-2 py-1.5"
            :class="s.level === 'warn' ? 'bg-accent-soft' : 'surface-soft'">
            <span class="mt-0.5 shrink-0 text-xs">{{ s.level === 'warn' ? '⚠️' : '💡' }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-xs leading-5"
                :class="s.level === 'warn' ? 'text-accent' : 'text-theme-secondary'">{{ s.reason }}</p>
              <p class="mt-0.5 truncate text-[10px] text-theme-tertiary">{{ s.refs.map((r) => r.title).join(' · ') }}</p>
            </div>
            <button class="shrink-0 text-[11px] text-accent transition-opacity hover:opacity-80"
              @click="emit('open', s.refs[0])">去处理</button>
            <button class="shrink-0 text-[11px] text-theme-tertiary transition-colors hover:text-theme-primary"
              @click="dismiss(s)">忽略</button>
          </li>
        </ul>

        <p class="mt-2 text-[10px] leading-4 text-theme-tertiary">
          分析会把条目标题发送给 DeepSeek，可随时关闭。
          <template v-if="data?.createdAt"> · {{ timeText(data.createdAt) }}</template>
        </p>
      </template>
    </div>
  </template>
</template>
