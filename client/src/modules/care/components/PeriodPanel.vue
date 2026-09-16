<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getPeriodSummary, listCareItems, removeCareItem } from '../care.api.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'

// 例假面板：服务端只返回原始预测数据，倒计时用设备本地「今天」计算
const router = useRouter()
const summary = ref([])
const history = ref([])

function toDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const dayDiff = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000)
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function periodState(s) {
  const now = today()
  const elapsed = dayDiff(now, s.latestStart)
  const until = dayDiff(s.nextStart, now)
  if (elapsed >= 0 && elapsed < s.durationDays) return { text: `经期第 ${elapsed + 1} 天`, hot: true }
  if (until < 0) return { text: `预计已推迟 ${-until} 天`, hot: true }
  if (until === 0) return { text: '预计今天来', hot: true }
  const label = `${Number(s.nextStart.slice(5, 7))}月${Number(s.nextStart.slice(8))}日`
  return { text: `预计 ${until} 天后（${label}）`, hot: until <= 3 }
}

function rangeText(item) {
  const start = item.start_date || item.startDate
  const end = item.end_date || item.endDate
  return end ? `${start} → ${end}` : start
}

async function load() {
  try {
    const [s, items] = await Promise.all([
      getPeriodSummary(),
      listCareItems({ category: 'period' }),
    ])
    summary.value = s?.subjects || []
    history.value = items || []
  } catch (e) {
    toast(e.message)
  }
}

async function remove(item) {
  const ok = await confirmDialog({ title: '删除例假记录', message: `确定删除「${item.title}」吗？` })
  if (!ok) return
  try {
    await removeCareItem(item.id)
    await load()
  } catch (e) {
    toast(e.message)
  }
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="space-y-4">
    <div v-if="summary.length" class="grid gap-3 sm:grid-cols-2">
      <article v-for="s in summary" :key="s.subject.id" class="glass p-5">
        <div class="text-sm text-theme-secondary">{{ s.subject.nickname }}</div>
        <div class="serif mt-2 text-xl" :class="periodState(s).hot ? 'text-accent-2' : 'text-theme-primary'">
          {{ periodState(s).text }}
        </div>
        <div class="mt-2 text-xs text-theme-tertiary">周期约 {{ s.avgCycle }} 天 · 最近 {{ s.latestStart }}</div>
      </article>
    </div>
    <div v-else class="glass p-8 text-center text-sm text-theme-tertiary">
      还没有例假记录，记录一次后就能看到温柔的预测。
    </div>

    <button class="btn-primary w-full" @click="router.push('/notebook/care/new?category=period')">＋ 记录这次</button>

    <div v-if="history.length" class="space-y-2">
      <h3 class="text-sm text-theme-secondary">历史记录</h3>
      <article v-for="item in history" :key="item.id"
        class="surface-soft flex items-center justify-between gap-3 rounded-2xl p-4">
        <div class="min-w-0">
          <div class="font-medium">{{ rangeText(item) }}</div>
          <p v-if="item.content" class="mt-1 break-words text-xs text-theme-tertiary">{{ item.content }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button class="min-h-11 px-2 text-xs text-theme-secondary hover:text-theme-primary"
            @click="router.push(`/notebook/care/${item.id}/edit`)">编辑</button>
          <button class="min-h-11 px-2 text-xs danger-link" @click="remove(item)">删除</button>
        </div>
      </article>
    </div>
  </div>
</template>
