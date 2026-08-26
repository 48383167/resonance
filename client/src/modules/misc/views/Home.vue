<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboard, getTreeState } from '../misc.api.js'
import { session, initSession } from '../../../stores/session'
import { socket } from '../../../socket'
import { toast } from '../../../stores/toast'
import { useGreeting } from '../../../composables/useTime'
import BreathingLight from '../../../shared/components/BreathingLight.vue'
import LoveTree from '../components/LoveTree.vue'

const router = useRouter()
const dash = ref(null)
const tree = ref(null)
const greeting = useGreeting()

const modules = [
  { name: 'timeline', icon: '🕰️', label: '时光时间线', desc: '我们的点点滴滴', color: 'rgb(var(--accent-rgb) / 0.25)' },
  { name: 'diary-list', icon: '📔', label: '日记', desc: '全部日记列表', color: 'rgb(var(--accent-2-rgb) / 0.22)' },
  { name: 'moments', icon: '✨', label: '恋爱瞬间', desc: '此刻的心情与地点', color: 'rgb(var(--accent-rgb) / 0.22)' },
  { name: 'map', icon: '🗺️', label: '恋爱地图', desc: '一起走过的足迹', color: 'rgb(var(--accent-2-rgb) / 0.22)' },
  { name: 'letters', icon: '💌', label: '情书', desc: '写给 Ta 的话', color: 'rgb(var(--accent-rgb) / 0.22)' },
  { name: 'albums', icon: '📷', label: '相册', desc: '照片与回忆', color: 'rgb(var(--accent-2-rgb) / 0.2)' },
  { name: 'wishes', icon: '🧭', label: '心愿清单', desc: '一起完成的事', color: 'rgb(var(--accent-rgb) / 0.2)' },
  { name: 'capsules', icon: '⏳', label: '时间胶囊', desc: '寄给未来的话', color: 'rgb(var(--accent-2-rgb) / 0.22)' },
  { name: 'anniversaries', icon: '📅', label: '纪念日', desc: '重要的日子', color: 'rgb(var(--accent-rgb) / 0.2)' },
  { name: 'diary', icon: '🗓️', label: '日记日历', desc: '按日期回顾', color: 'rgb(var(--accent-2-rgb) / 0.18)' },
]

async function load() {
  try {
    const [d, t] = await Promise.all([getDashboard(), getTreeState()])
    dash.value = d
    tree.value = t
  } catch (e) {
    toast(e.message)
  }
}

// 伴侣上线时刷新（大概率刚完成配对注册）
function onPresence(p) {
  if (p.online && p.userId !== session.userId && dash.value && !dash.value.partner) load()
}

onMounted(async () => {
  if (!session.me) await initSession()
  await load()
  socket.on('user_presence', onPresence)
})

onUnmounted(() => {
  socket.off('user_presence', onPresence)
})

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(dash.value.inviteCode)
    toast('配对码已复制')
  } catch { /* 忽略 */ }
}

const statCards = (s) => [
  { icon: '✨', label: '恋爱瞬间', value: s.moments, route: '/moments' },
  { icon: '📔', label: '日记', value: s.entries, route: '/diary-list' },
  { icon: '📷', label: '照片', value: s.photos, route: '/albums' },
  { icon: '🎉', label: '心愿完成', value: s.wishesDone, route: '/wishes' },
  { icon: '⏳', label: '时间胶囊', value: s.capsules, route: '/capsules' },
]
</script>

<template>
  <div v-if="dash" class="fade-up space-y-5">
    <!-- 我们 -->
    <div class="flex items-center justify-between rounded-2xl bg-white/5 p-5 backdrop-blur">
      <div class="flex items-center gap-4">
        <BreathingLight :online="session.partnerOnline" :size="48" />
        <div>
          <div class="flex items-center gap-2 text-lg">
            <span class="font-semibold">{{ dash.me.nickname }}</span>
            <span class="text-white/40">×</span>
            <span class="font-semibold text-accent">{{ dash.partner?.nickname || '…' }}</span>
          </div>
          <div class="mt-0.5 text-xs text-white/50">
            <template v-if="dash.partner">
              相识 <b class="text-amber-200">{{ dash.daysTogether }}</b> 天
              <template v-if="dash.upcomingAnniversary">
                · 最近纪念日：{{ dash.upcomingAnniversary.title }}（{{ dash.upcomingAnniversary.date }}）
              </template>
            </template>
            <template v-else>等 Ta 加入，一起开启属于你们的时间</template>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click="router.push('/write/solo')">✎ 写日记</button>
    </div>

    <!-- 未配对：展示配对码 -->
    <div v-if="!dash.partner" class="glass p-5 text-center">
      <p class="text-sm text-white/60">等 Ta 注册时填写配对码，即可完成配对：</p>
      <div class="serif mt-2 text-2xl font-bold tracking-[0.4em] text-accent">{{ dash.inviteCode }}</div>
      <button class="btn-ghost mt-3" @click="copyInvite">复制配对码</button>
    </div>

    <!-- 恋爱树 + 统计 -->
    <div class="grid gap-4 md:grid-cols-2">
      <div class="glass flex items-center justify-center p-5">
        <LoveTree v-if="tree" :stage="tree.stage" :progress="tree.progress"
          :total="tree.total" :next-at="tree.nextAt" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="c in statCards(dash.stats)" :key="c.label"
          class="glass flex cursor-pointer flex-col items-center justify-center p-4 text-center transition-all hover:-translate-y-0.5 hover:bg-white/10"
          @click="router.push(c.route)">
          <div class="text-sm opacity-70">{{ c.icon }}</div>
          <div class="mt-1 text-2xl font-bold text-accent">{{ c.value }}</div>
          <div class="mt-1 text-xs text-white/50">{{ c.label }} →</div>
        </div>
        <div class="glass col-span-2 flex cursor-pointer items-center justify-center p-4 transition-all hover:-translate-y-0.5 hover:bg-white/10"
          title="查看未读情书" @click="router.push('/letters')">
          <div class="text-center">
            <div class="text-2xl font-bold text-accent-2">{{ dash.stats.unreadLetters }}</div>
            <div class="mt-1 text-xs text-white/50">未读情书 →</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模块入口 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
      <button v-for="m in modules" :key="m.name" @click="router.push(`/${m.name}`)"
        class="glass group p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/10">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl text-lg" :style="{ background: m.color }">
            {{ m.icon }}
          </span>
          <div>
            <div class="font-medium">{{ m.label }}</div>
            <div class="text-xs text-white/45">{{ m.desc }}</div>
          </div>
        </div>
      </button>
    </div>
  </div>
  <div v-else class="flex min-h-[50vh] items-center justify-center text-white/40">正在收拾小屋…</div>
</template>
