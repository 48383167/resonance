<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { toast } from '../stores/toast'
import { confirmDialog } from '../stores/confirm'

const router = useRouter()
const wishes = ref([])

const COLUMNS = [
  { key: 'todo', label: '待办', icon: '🌱' },
  { key: 'doing', label: '进行中', icon: '🔥' },
  { key: 'done', label: '已完成', icon: '🎉' },
]
const CATEGORIES = [
  { value: 'travel', label: '旅行', icon: '✈️' },
  { value: 'food', label: '美食', icon: '🍜' },
  { value: 'gift', label: '礼物', icon: '🎁' },
  { value: 'life', label: '生活', icon: '🏠' },
  { value: 'other', label: '其他', icon: '✨' },
]
const catLabel = (k) => CATEGORIES.find((c) => c.value === k)?.label || '其他'
const byColumn = (key) => wishes.value.filter((w) => w.status === key)

const dateOf = (iso) => (iso ? new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '')

async function load() {
  wishes.value = await api.get('/api/wishes')
}
onMounted(load)

async function move(w, dir) {
  const order = ['todo', 'doing', 'done']
  const i = order.indexOf(w.status) + dir
  if (i < 0 || i > 2) return
  try {
    await api.put(`/api/wishes/${w.id}/status`, { status: order[i] })
    if (order[i] === 'done') toast(`🎉 完成了一个心愿：${w.title}`)
    else toast(`「${w.title}」已进入${order[i] === 'doing' ? '进行中' : '待办'}`)
    await load()
  } catch (e) {
    toast(e.message)
  }
}

async function remove(w) {
  const ok = await confirmDialog({ title: '删除心愿', message: `确定删除心愿「${w.title}」吗？` })
  if (!ok) return
  await api.delete(`/api/wishes/${w.id}`)
  await load()
}
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">心愿清单</h2>
        <p class="text-xs text-white/45">想一起做的事，从待办到完成</p>
      </div>
      <button class="btn-primary" @click="router.push('/wishes/new')">+ 许个心愿</button>
    </div>

    <!-- items-start：各列高度随内容自适应，互不撑开 -->
    <div class="grid items-start gap-4 md:grid-cols-3">
      <div v-for="col in COLUMNS" :key="col.key" class="glass p-3">
        <div class="mb-3 flex items-center justify-between px-1">
          <span class="text-sm text-white/70">{{ col.icon }} {{ col.label }}</span>
          <span class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">{{ byColumn(col.key).length }}</span>
        </div>
        <div class="space-y-2">
          <div v-for="w in byColumn(col.key)" :key="w.id"
            class="cursor-pointer rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
            @click="router.push(`/wishes/${w.id}`)">
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm font-medium">
                <span v-if="w.priority >= 2" title="非常想">⭐ </span>{{ w.title }}
              </span>
              <div class="flex gap-1.5 text-xs">
                <button v-if="col.key !== 'done'" class="text-accent-2 hover-text-accent-2" title="下一阶段" @click.stop="move(w, 1)">→</button>
                <button v-if="col.key !== 'todo'" class="text-white/40 hover:text-white" title="上一阶段" @click.stop="move(w, -1)">←</button>
              </div>
            </div>
            <p v-if="w.description" class="mt-1 text-xs text-white/45">{{ w.description }}</p>
            <div class="mt-2 flex items-center justify-between text-xs">
              <span class="rounded-full bg-accent-soft px-2 py-0.5 text-accent">{{ catLabel(w.category) }}</span>
              <span class="text-white/40">by {{ w.proposer?.nickname }} · {{ dateOf(w.created_at) }} 提出</span>
            </div>
            <!-- 阶段时间节点：进行中记开始时间，完成记完成时间 -->
            <div class="mt-1.5 flex items-center justify-between text-[11px]">
              <span v-if="col.key === 'doing' && w.started_at" class="text-accent-2">
                🔥 {{ dateOf(w.started_at) }} 开始
              </span>
              <span v-else-if="col.key === 'done' && w.completed_at" class="text-emerald-300/70">
                ✓ {{ dateOf(w.completed_at) }} 完成
              </span>
              <span v-else />
              <span class="flex gap-3">
                <button class="hover:text-white" @click.stop="router.push(`/wishes/${w.id}/edit`)">编辑</button>
                <button class="hover:text-rose-300" @click.stop="remove(w)">删除</button>
              </span>
            </div>
          </div>
          <div v-if="!byColumn(col.key).length" class="py-4 text-center text-xs text-white/30">空空如也</div>
        </div>
      </div>
    </div>
  </div>
</template>
