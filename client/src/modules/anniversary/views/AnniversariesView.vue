<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listAnniversaries, removeAnniversary, updateAnniversaryShareVisibility } from '../anniversary.api.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'

const router = useRouter()
const items = ref([])
const sharing = ref(new Set())

const TYPES = [
  { key: 'first_meet', label: '初遇', icon: '🌸' },
  { key: 'together', label: '在一起', icon: '💞' },
  { key: 'birthday', label: '生日', icon: '🎂' },
  { key: 'custom', label: '自定义', icon: '✨' },
]
const typeLabel = (k) => TYPES.find((t) => t.key === k)?.label || '自定义'

async function load() {
  items.value = await listAnniversaries()
}
onMounted(load)

async function remove(a) {
  const ok = await confirmDialog({ title: '删除纪念日', message: `确定删除纪念日「${a.title}」吗？` })
  if (!ok) return
  await removeAnniversary(a.id)
  await load()
}

const isShownInShare = (a) => a.show_in_share !== 0

async function toggleShareVisibility(a) {
  if (sharing.value.has(a.id)) return
  const showInShare = !isShownInShare(a)
  sharing.value = new Set(sharing.value).add(a.id)
  try {
    const updated = await updateAnniversaryShareVisibility(a.id, showInShare)
    Object.assign(a, updated)
    toast(showInShare ? '已在分享页展示' : '已从分享页隐藏')
  } catch (error) {
    toast(error.message || '更新分享展示状态失败', 'error')
  } finally {
    const next = new Set(sharing.value)
    next.delete(a.id)
    sharing.value = next
  }
}

const countText = (a) => {
  if (a.isToday) return '就是今天 🎉'
  return a.daysUntil === 0 ? '' : `还有 ${a.daysUntil} 天`
}
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="serif text-xl">纪念日</h2>
        <p class="text-xs text-white/45">初遇、在一起、生日…每个重要的日子</p>
      </div>
      <button class="btn-primary w-full sm:w-auto" @click="router.push('/anniversaries/new')">+ 添加纪念日</button>
    </div>

    <div v-if="!items.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">📅</div>
      <p class="mt-2">还没有纪念日，把「在一起」那天记下来吧</p>
      <button class="btn-primary mt-4" @click="router.push('/anniversaries/new')">添加第一个纪念日</button>
    </div>

    <div class="space-y-3">
      <div v-for="a in items" :key="a.id" class="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
        :class="a.isToday ? 'ring-1 ring-amber-300/50' : ''">
        <div class="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft">
          <span class="text-lg font-bold text-accent">{{ a.date.slice(8, 10) }}</span>
          <span class="text-[10px] text-white/50">{{ a.date.slice(5, 7) }}月</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="break-words font-medium">{{ a.title }}</span>
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/55">{{ typeLabel(a.type) }}</span>
          </div>
           <p v-if="a.description" class="mt-0.5 break-words text-xs text-white/45">{{ a.description }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span class="text-amber-200/90">{{ countText(a) }}</span>
            <span v-if="!a.isToday && a.daysUntil > 0 && a.daysUntil <= 30"
              class="rounded-full bg-sky-400/20 px-2 py-0.5 text-sky-200">即将到来</span>
            <span class="ml-1 text-white/40">已一起走过 {{ a.daysSince }} 天</span>
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3 text-xs sm:justify-start sm:border-0 sm:pt-0">
          <button type="button"
             class="min-h-8 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            :class="isShownInShare(a)
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-theme surface-soft text-theme-secondary hover-text-accent'"
            :disabled="sharing.has(a.id)" :aria-pressed="isShownInShare(a)"
            :aria-label="isShownInShare(a) ? '分享页展示中，点击关闭' : '分享页不展示，点击开启'"
            @click="toggleShareVisibility(a)">
            {{ sharing.has(a.id) ? '更新中…' : (isShownInShare(a) ? '✓ 分享页展示' : '分享页不展示') }}
          </button>
          <button class="text-white/50 hover:text-white" @click="router.push(`/anniversaries/${a.id}/edit`)">编辑</button>
          <button class="text-rose-300/70 hover:text-rose-300" @click="remove(a)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
