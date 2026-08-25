<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { toast } from '../stores/toast'
import { confirmDialog } from '../stores/confirm'

// 胶囊详情：独立页面（随内容自然展开）
const route = useRoute()
const router = useRouter()
const capsule = ref(null)

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/capsules')
}

async function load() {
  try {
    capsule.value = await api.get(`/api/capsules/${route.params.id}`)
  } catch (e) {
    toast(e.message)
    router.push('/capsules')
  }
}
onMounted(load)

async function remove() {
  const ok = await confirmDialog({ title: '销毁胶囊', message: `确定销毁「${capsule.value.title || '无题胶囊'}」吗？销毁后无法恢复。` })
  if (!ok) return
  await api.delete(`/api/capsules/${capsule.value.id}`)
  toast('胶囊已销毁')
  router.push('/capsules')
}

const unlockText = (c) => {
  if (c.isUnlocked) return '已解锁'
  if (c.daysUntilUnlock === 0) return '今天解锁'
  if (c.daysUntilUnlock === 1) return '明天解锁'
  return `还有 ${c.daysUntilUnlock} 天解锁`
}
</script>

<template>
  <div class="fade-up">
    <div class="mb-4 flex items-center justify-between">
      <button class="btn-ghost text-sm" @click="goBack">← 返回</button>
      <button v-if="capsule" class="text-xs text-rose-300/70 hover:text-rose-300" @click="remove">销毁</button>
    </div>

    <div v-if="!capsule" class="py-20 text-center text-white/40">正在打开胶囊…</div>

    <div v-else class="glass p-6 sm:p-10">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="rounded-full px-3 py-1 text-xs"
          :class="capsule.isUnlocked ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/15 text-amber-200'">
          {{ capsule.isUnlocked ? '🔓' : '🔒' }} {{ unlockText(capsule) }}
        </span>
        <span class="text-xs text-white/40">由 {{ capsule.author?.nickname }} 密封 · 解锁于 {{ capsule.unlock_date }}</span>
      </div>

      <h1 class="serif mt-6 text-2xl font-bold">{{ capsule.title || '无题胶囊' }}</h1>

      <p class="serif mt-6 whitespace-pre-wrap text-base leading-loose"
        :class="capsule.isUnlocked ? 'text-white/85' : 'text-white/40 blur-[4px] select-none'">
        {{ capsule.content }}
      </p>

      <img v-if="capsule.isUnlocked && capsule.photoUrl" :src="capsule.photoUrl"
        class="mt-6 max-h-72 rounded-xl object-contain" />
    </div>
  </div>
</template>
