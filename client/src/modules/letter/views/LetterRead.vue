<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getLetter, removeLetter } from '../letter.api.js'
import { session } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'

// 读信：独立页面，信纸随内容自然展开（不再用固定窗体的弹窗）
const route = useRoute()
const router = useRouter()
const letter = ref(null)

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/letters')
}

async function load() {
  try {
    letter.value = await getLetter(route.params.id)
  } catch (e) {
    toast(e.message)
    router.push('/letters')
  }
}
onMounted(load)

async function remove() {
  const ok = await confirmDialog({ title: '删除情书', message: '确定删除这封信吗？删除后无法恢复。' })
  if (!ok) return
  await removeLetter(letter.value.id)
  toast('已删除')
  router.push('/letters')
}

const dateText = (l) => (l
  ? new Date(l.created_at).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '')
</script>

<template>
  <div class="fade-up">
    <div class="mb-4 flex items-center justify-between">
      <button class="btn-ghost text-sm" @click="goBack">← 信箱</button>
      <div v-if="letter" class="flex items-center gap-3">
        <button v-if="letter.sender_id === session.userId"
          class="text-xs text-white/50 transition-colors hover:text-white"
          @click="router.push(`/letters/${letter.id}/edit`)">✎ 编辑</button>
        <button class="text-xs text-rose-300/70 hover:text-rose-300" @click="remove">删除</button>
      </div>
    </div>

    <div v-if="!letter" class="py-20 text-center text-white/40">正在展开信纸…</div>

    <!-- 信纸：高度完全随内容 -->
    <div v-else class="letter-sheet relative p-6 sm:p-10">
      <div class="paper-lines pointer-events-none absolute inset-0" />
      <div class="relative z-10">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="serif text-2xl font-bold">{{ letter.title || '无题情书' }}</h1>
            <div class="mt-2 text-xs opacity-60">
              ✎ {{ letter.sender?.nickname }} · {{ dateText(letter) }}
              <span v-if="letter.is_secret">· 🔐 秘密信件</span>
            </div>
          </div>
          <span v-if="letter.is_secret" class="shrink-0 text-lg">🔐</span>
        </div>
        <p class="serif mt-6 whitespace-pre-wrap text-lg leading-loose">{{ letter.content }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.letter-sheet {
  background: linear-gradient(160deg, #f7f0df, #efe4cc);
  color: #3a2c1a;
  position: relative;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), inset 0 0 40px rgba(150, 120, 70, 0.12);
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
