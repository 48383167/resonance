<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { session } from '../stores/session'
import { toast } from '../stores/toast'
import { confirmDialog } from '../stores/confirm'

const router = useRouter()
const letters = ref([])

// 未读置顶，其余按时间倒序
const sortedLetters = computed(() => [...letters.value].sort((a, b) => {
  if ((a.is_read === 0) !== (b.is_read === 0)) return a.is_read === 0 ? -1 : 1
  return a.created_at < b.created_at ? 1 : -1
}))

async function load() {
  letters.value = await api.get('/api/letters')
}
onMounted(load)

function open(l) {
  router.push(`/letters/${l.id}`)
}

async function remove(l) {
  const ok = await confirmDialog({ title: '删除情书', message: '确定删除这封信吗？删除后无法恢复。' })
  if (!ok) return
  await api.delete(`/api/letters/${l.id}`)
  await load()
  toast('已删除')
}

const dateText = (l) => new Date(l.created_at).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">情书</h2>
        <p class="text-xs text-white/45">写一封只给 Ta 看的信</p>
      </div>
      <button class="btn-primary" @click="router.push('/letters/write')">✎ 写信</button>
    </div>

    <div v-if="!letters.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">💌</div>
      <p class="mt-2">信箱还空着，写第一封情书吧</p>
    </div>

    <!-- 纸感信卡 -->
    <div class="grid gap-4 md:grid-cols-2">
      <div v-for="(l, i) in sortedLetters" :key="l.id"
        class="paper-card group relative cursor-pointer p-5 transition-transform hover:-translate-y-0.5 hover:rotate-0"
        :style="{ transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }"
        @click="open(l)">
        <div class="flex items-start justify-between">
          <span class="text-lg">{{ l.is_secret ? '🔐' : '💌' }}</span>
          <div class="flex items-center gap-2.5">
            <span v-if="l.is_read === 0" class="h-2 w-2 rounded-full bg-rose-500" title="未读" />
            <button v-if="l.sender_id === session.userId"
              class="text-[11px] text-black/45 transition-colors hover:text-black/70"
              @click.stop="router.push(`/letters/${l.id}/edit`)">编辑</button>
            <button class="text-[11px] text-rose-400/70 hover:text-rose-400" @click.stop="remove(l)">删除</button>
          </div>
        </div>
        <h3 class="serif mt-2 text-lg font-semibold" :class="l.title ? '' : 'text-black/40'">{{ l.title || '无题情书' }}</h3>
        <p class="serif mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed">{{ l.content }}</p>
        <div class="mt-3 flex items-center justify-between text-[11px]">
          <span>✎ {{ l.sender?.nickname }}</span>
          <span>{{ dateText(l) }}</span>
        </div>
        <!-- 纸面横线 -->
        <div class="paper-lines pointer-events-none absolute inset-x-6 top-16 bottom-10" />
      </div>
    </div>

    <!-- 写信改为独立页面 /letters/write -->

    <!-- 读信改为独立页面 /letters/:id -->
  </div>
</template>

<style scoped>
/* 纸感质感 */
.paper-card {
  background: linear-gradient(160deg, #f7f0df, #efe4cc);
  border: 1px solid rgba(120, 90, 40, 0.18);
  border-radius: 10px;
  color: #3a2c1a;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35), inset 0 0 30px rgba(150, 120, 70, 0.12);
  position: relative;
}
.paper-lines {
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 26px,
    rgba(90, 70, 40, 0.12) 26px,
    rgba(90, 70, 40, 0.12) 27px
  );
}
</style>
