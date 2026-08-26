<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { toast } from '../stores/toast'
import { confirmDialog } from '../stores/confirm'

const router = useRouter()
const items = ref([])

const TYPES = [
  { key: 'first_meet', label: '初遇', icon: '🌸' },
  { key: 'together', label: '在一起', icon: '💞' },
  { key: 'birthday', label: '生日', icon: '🎂' },
  { key: 'custom', label: '自定义', icon: '✨' },
]
const typeLabel = (k) => TYPES.find((t) => t.key === k)?.label || '自定义'

async function load() {
  items.value = await api.get('/api/anniversaries')
}
onMounted(load)

async function remove(a) {
  const ok = await confirmDialog({ title: '删除纪念日', message: `确定删除纪念日「${a.title}」吗？` })
  if (!ok) return
  await api.delete(`/api/anniversaries/${a.id}`)
  await load()
}

const countText = (a) => {
  if (a.isToday) return '就是今天 🎉'
  return a.daysUntil === 0 ? '' : `还有 ${a.daysUntil} 天`
}
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">纪念日</h2>
        <p class="text-xs text-white/45">初遇、在一起、生日…每个重要的日子</p>
      </div>
      <button class="btn-primary" @click="router.push('/anniversaries/new')">+ 添加纪念日</button>
    </div>

    <div v-if="!items.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">📅</div>
      <p class="mt-2">还没有纪念日，把「在一起」那天记下来吧</p>
      <button class="btn-primary mt-4" @click="router.push('/anniversaries/new')">添加第一个纪念日</button>
    </div>

    <div class="space-y-3">
      <div v-for="a in items" :key="a.id" class="glass flex items-center gap-4 p-4"
        :class="a.isToday ? 'ring-1 ring-amber-300/50' : ''">
        <div class="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-accent-soft">
          <span class="text-lg font-bold text-accent">{{ a.date.slice(8, 10) }}</span>
          <span class="text-[10px] text-white/50">{{ a.date.slice(5, 7) }}月</span>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ a.title }}</span>
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/55">{{ typeLabel(a.type) }}</span>
          </div>
          <p v-if="a.description" class="mt-0.5 text-xs text-white/45">{{ a.description }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span class="text-amber-200/90">{{ countText(a) }}</span>
            <span v-if="!a.isToday && a.daysUntil > 0 && a.daysUntil <= 30"
              class="rounded-full bg-sky-400/20 px-2 py-0.5 text-sky-200">即将到来</span>
            <span class="ml-1 text-white/40">已一起走过 {{ a.daysSince }} 天</span>
          </div>
        </div>
        <div class="flex gap-3 text-xs">
          <button class="text-white/50 hover:text-white" @click="router.push(`/anniversaries/${a.id}/edit`)">编辑</button>
          <button class="text-rose-300/70 hover:text-rose-300" @click="remove(a)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
