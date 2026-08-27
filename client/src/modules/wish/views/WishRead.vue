<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWish, setWishStatus, removeWish } from '../wish.api.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'

// 心愿详情（只读）：点击卡片查看，可在此编辑/删除/流转
const route = useRoute()
const router = useRouter()
const wish = ref(null)

const COLUMNS = { todo: '待办', doing: '进行中', done: '已完成' }
const CATEGORIES = [
  { value: 'travel', label: '旅行', icon: '✈️' },
  { value: 'food', label: '美食', icon: '🍜' },
  { value: 'gift', label: '礼物', icon: '🎁' },
  { value: 'life', label: '生活', icon: '🏠' },
  { value: 'other', label: '其他', icon: '✨' },
]
const PRIORITIES = [
  { value: 0, label: '普通', icon: '·' },
  { value: 1, label: '重要', icon: '🔶' },
  { value: 2, label: '非常想', icon: '⭐' },
]
const cat = (k) => CATEGORIES.find((c) => c.value === k) || CATEGORIES[4]
const prio = (k) => PRIORITIES.find((p) => p.value === k) || PRIORITIES[0]

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/wishes')
}

async function load() {
  try {
    wish.value = await getWish(route.params.id)
  } catch (e) {
    toast(e.message)
    router.push('/wishes')
  }
}
onMounted(load)

async function move(dir) {
  const order = ['todo', 'doing', 'done']
  const i = order.indexOf(wish.value.status) + dir
  if (i < 0 || i > 2) return
  try {
    await setWishStatus(wish.value.id, order[i])
    wish.value = await getWish(wish.value.id)
    if (order[i] === 'done') toast('🎉 完成了一个心愿！')
  } catch (e) {
    toast(e.message)
  }
}

async function remove() {
  const ok = await confirmDialog({ title: '删除心愿', message: `确定删除心愿「${wish.value.title}」吗？` })
  if (!ok) return
  await removeWish(wish.value.id)
  toast('已删除')
  router.push('/wishes')
}

const dateText = (iso) => (iso ? new Date(iso).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
</script>

<template>
  <div class="fade-up">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <button class="btn-ghost text-sm" @click="goBack">← 返回</button>
      <div v-if="wish" class="flex flex-wrap items-center justify-end gap-4">
        <button class="text-xs text-white/50 transition-colors hover:text-white"
          @click="router.push(`/wishes/${wish.id}/edit`)">✎ 编辑</button>
        <button class="text-xs text-rose-300/70 hover:text-rose-300" @click="remove">删除</button>
      </div>
    </div>

    <div v-if="!wish" class="py-20 text-center text-white/40">加载中…</div>

    <div v-else class="glass p-6">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full bg-white/10 px-3 py-1 text-white/60">{{ COLUMNS[wish.status] }}</span>
        <span class="rounded-full bg-accent-soft px-3 py-1 text-accent">{{ cat(wish.category).icon }} {{ cat(wish.category).label }}</span>
        <span class="rounded-full bg-white/10 px-3 py-1 text-white/60">{{ prio(wish.priority).icon }} {{ prio(wish.priority).label }}</span>
      </div>

      <h1 class="serif mt-5 break-words text-2xl font-bold">{{ wish.title }}</h1>

      <p v-if="wish.description" class="mt-4 break-words whitespace-pre-wrap leading-relaxed text-white/75">{{ wish.description }}</p>

      <div class="mt-6 space-y-1 text-xs text-white/40">
        <div>by {{ wish.proposer?.nickname }} · 提出于 {{ dateText(wish.created_at) }}</div>
        <div v-if="wish.status === 'doing' && wish.started_at" class="text-accent-2">🔥 {{ dateText(wish.started_at) }} 开始</div>
        <div v-if="wish.status === 'done' && wish.completed_at" class="text-emerald-300/70">✓ {{ dateText(wish.completed_at) }} 完成</div>
      </div>

      <!-- 阶段流转 -->
      <div class="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
        <button v-if="wish.status !== 'done'" class="btn-primary w-full px-5 py-2 text-sm sm:w-auto" @click="move(1)">
          {{ wish.status === 'todo' ? '开始去做 →' : '完成了 🎉' }}
        </button>
        <button v-if="wish.status !== 'todo'" class="btn-ghost w-full px-5 py-2 text-sm sm:w-auto" @click="move(-1)">← 退回上一阶段</button>
      </div>
    </div>
  </div>
</template>
