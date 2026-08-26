<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listCapsules, removeCapsule } from '../capsule.api.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'

const router = useRouter()
const capsules = ref([])

// 未解锁的置顶（按解锁日升序），已解锁的沉底
const sortedCapsules = computed(() => [...capsules.value].sort((a, b) => {
  if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? 1 : -1
  return a.unlock_date < b.unlock_date ? -1 : 1
}))

async function load() {
  capsules.value = await listCapsules()
}
onMounted(load)

async function remove(c) {
  const ok = await confirmDialog({ title: '销毁胶囊', message: `确定销毁「${c.title || '无题胶囊'}」吗？销毁后无法恢复。` })
  if (!ok) return
  await removeCapsule(c.id)
  await load()
  toast('胶囊已销毁')
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const unlockText = (c) => {
  if (c.isUnlocked) return '已解锁'
  if (c.unlock_date === todayStr()) return '今天解锁'
  if (c.daysUntilUnlock === 1) return '明天解锁'
  return `还有 ${c.daysUntilUnlock} 天解锁`
}
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">时间胶囊</h2>
        <p class="text-xs text-white/45">把话寄给未来的你们，到期才能打开</p>
      </div>
      <button class="btn-primary" @click="router.push('/capsules/new')">+ 密封一枚</button>
    </div>

    <div v-if="!capsules.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">⏳</div>
      <p class="mt-2">还没有胶囊，写给未来的你们吧</p>
      <button class="btn-primary mt-4" @click="router.push('/capsules/new')">密封第一枚胶囊</button>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div v-for="c in sortedCapsules" :key="c.id"
        class="glass cursor-pointer p-5 transition-colors hover:bg-white/10"
        @click="router.push(`/capsules/${c.id}`)">
        <div class="flex items-center justify-between">
          <span class="text-sm text-white/70">{{ c.title || '无题胶囊' }}</span>
          <span class="rounded-full px-2.5 py-0.5 text-xs"
              :class="c.isUnlocked ? 'bg-emerald-400/20 text-emerald-200'
                : (c.unlock_date === todayStr() ? 'bg-sky-400/25 text-sky-200' : 'bg-amber-400/15 text-amber-200')">
            {{ c.isUnlocked ? '🔓' : '🔒' }} {{ unlockText(c) }}
          </span>
        </div>
        <p class="mt-3 text-sm" :class="c.isUnlocked ? 'whitespace-pre-wrap text-white/80' : 'text-white/40 blur-[3px] select-none'">
          {{ c.content }}
        </p>
        <div class="mt-3 flex items-center justify-between text-xs text-white/40">
          <span>由 {{ c.author?.nickname }} 密封 · 解锁于 {{ c.unlock_date }}</span>
          <button class="hover:text-rose-300" @click.stop="remove(c)">销毁</button>
        </div>
      </div>
    </div>
  </div>
</template>
