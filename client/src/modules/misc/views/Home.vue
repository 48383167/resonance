<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboard, getTreeState, setFirstMeetAt } from '../misc.api.js'
import { session, initSession } from '../../../stores/session'
import { commentUnread } from '../../../stores/commentUnread'
import { socket } from '../../../socket'
import { toast } from '../../../stores/toast'
import { useGreeting } from '../../../composables/useTime'
import BreathingLight from '../../../shared/components/BreathingLight.vue'
import LoveTree from '../components/LoveTree.vue'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'
import { pins } from '../../../stores/pins'

const router = useRouter()
const dash = ref(null)
const tree = ref(null)
const greeting = useGreeting()

const editMeet = ref(false)
const meetDate = ref('')
const meetBusy = ref(false)

const modules = [
  { name: 'timeline', icon: '🕰️', label: '时光时间线', desc: '我们的点点滴滴', color: 'rgb(var(--accent-rgb) / 0.25)' },
  { name: 'diary-list', icon: '📔', label: '日记', desc: '全部日记列表', color: 'rgb(var(--accent-2-rgb) / 0.22)' },
  { name: 'moments', icon: '✨', label: '恋爱瞬间', desc: '此刻的心情与地点', color: 'rgb(var(--accent-rgb) / 0.22)' },
  { name: 'map', icon: '🗺️', label: '恋爱地图', desc: '一起走过的足迹', color: 'rgb(var(--accent-2-rgb) / 0.22)' },
  { name: 'letters', icon: '💌', label: '情书', desc: '写给 Ta 的话', color: 'rgb(var(--accent-rgb) / 0.22)' },
  { name: 'companion', icon: '☾', label: '心语陪伴', desc: '只听你说说', color: 'rgb(var(--accent-2-rgb) / 0.2)' },
  { name: 'albums', icon: '📷', label: '相册', desc: '照片与回忆', color: 'rgb(var(--accent-2-rgb) / 0.2)' },
  { name: 'wishes', icon: '🧭', label: '心愿清单', desc: '一起完成的事', color: 'rgb(var(--accent-rgb) / 0.2)' },
  { name: 'capsules', icon: '⏳', label: '时间胶囊', desc: '寄给未来的话', color: 'rgb(var(--accent-2-rgb) / 0.22)' },
  { name: 'anniversaries', icon: '📅', label: '纪念日', desc: '重要的日子', color: 'rgb(var(--accent-rgb) / 0.2)' },
  { name: 'notebook', icon: '📒', label: '小本本', desc: '忌口 · 例假 · 规矩', color: 'rgb(var(--accent-rgb) / 0.22)' },
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

// 对方修改相识日期时实时刷新
function onCoupleUpdated(p) {
  if (!dash.value) return
  dash.value.daysTogether = p.daysTogether
  dash.value.firstMeetAt = p.firstMeetAt
}
const dateText = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const dateObj = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const diff = (a, b) => Math.round((dateObj(a) - dateObj(b)) / 86400000)
function periodText(p) { const elapsed = diff(dateText(), p.latestStart); const until = diff(p.nextStart, dateText()); if (elapsed >= 0 && elapsed < p.durationDays) return { text: `经期第 ${elapsed + 1} 天`, hot: true }; return { text: until <= 0 ? (until === 0 ? '预计今天来' : `预计已推迟 ${-until} 天`) : `预计 ${until} 天后`, hot: until <= 3 } }
function onCareUpdated() { load() }

onMounted(async () => {
  if (!session.me) await initSession()
  await load()
  socket.on('user_presence', onPresence)
  socket.on('couple:updated', onCoupleUpdated)
  socket.on('care:created', onCareUpdated); socket.on('care:updated', onCareUpdated); socket.on('care:deleted', onCareUpdated)
})

onUnmounted(() => {
  socket.off('user_presence', onPresence)
  socket.off('couple:updated', onCoupleUpdated)
  socket.off('care:created', onCareUpdated); socket.off('care:updated', onCareUpdated); socket.off('care:deleted', onCareUpdated)
})

function toggleMeetEditor() {
  if (!dash.value?.partner) return
  editMeet.value = !editMeet.value
  if (editMeet.value) meetDate.value = dash.value.firstMeetAt || ''
}

async function saveMeet() {
  if (meetBusy.value || !meetDate.value) return
  meetBusy.value = true
  try {
    const r = await setFirstMeetAt(meetDate.value)
    dash.value.firstMeetAt = r.firstMeetAt
    dash.value.daysTogether = r.daysTogether
    editMeet.value = false
    toast('相识日期已更新')
  } catch (e) {
    toast(e.message)
  } finally {
    meetBusy.value = false
  }
}

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

// 评论未读角标：日记 / 恋爱瞬间模块入口
function unreadOfModule(name) {
  if (name === 'diary-list') return commentUnread.entry
  if (name === 'moments') return commentUnread.moment
  return 0
}
</script>

<template>
  <div v-if="dash" class="fade-up space-y-5">
    <section v-if="pins.global.length" class="glass p-5">
      <div class="mb-3 flex items-center justify-between"><h2 class="serif text-lg">📌 我们记着</h2><button class="text-xs text-accent" @click="router.push('/notebook')">查看全部 →</button></div>
      <div class="flex flex-wrap gap-2"><button v-for="item in pins.global.slice(0, 6)" :key="item.targetType + item.targetId" class="rounded-full border px-3 py-2 text-sm" :class="item.type === 'redline' ? 'danger-link border-current' : 'border-accent text-accent'" @click="router.push({ path: '/notebook', query: { tab: item.targetType === 'care' && item.category === 'period' ? 'period' : item.targetType } })">{{ item.title }}</button></div>
    </section>
    <!-- 我们 -->
    <div class="relative z-20 rounded-2xl bg-white/5 p-5 backdrop-blur">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-center gap-3 sm:gap-4">
          <BreathingLight :online="session.partnerOnline" :size="48" />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 text-lg">
              <span class="font-semibold">{{ dash.me.nickname }}</span>
               <span class="text-theme-tertiary">×</span>
              <span class="break-words font-semibold text-accent">{{ dash.partner?.nickname || '…' }}</span>
            </div>
             <div class="mt-0.5 text-xs text-theme-tertiary">
              <template v-if="dash.partner">
                 <button class="group/meet inline-flex items-center gap-1.5 hover:text-theme-primary" title="设置相识日期"
                  @click="toggleMeetEditor">
                  相识 <b class="text-amber-200">{{ dash.daysTogether }}</b> 天
                   <span class="text-xs text-theme-tertiary transition-colors group-hover/meet:text-accent"
                    :class="editMeet ? 'text-accent' : ''">✎</span>
                </button>
                <template v-if="dash.upcomingAnniversary">
                  · 最近纪念日：{{ dash.upcomingAnniversary.title }}（{{ dash.upcomingAnniversary.date }}）
                </template>
              </template>
              <template v-else>等 Ta 加入，一起开启属于你们的时间</template>
            </div>
          </div>
        </div>
        <button class="btn-primary w-full sm:w-auto" @click="router.push('/write/solo')">✎ 写日记</button>
      </div>

      <!-- 相识日期：行内编辑 -->
      <Transition name="meet">
        <div v-if="dash.partner && editMeet"
          class="relative z-20 mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div class="flex items-center justify-between">
           <label class="text-xs text-theme-secondary">相识日期</label>
           <span class="text-[10px] text-theme-tertiary">选好后从这天开始计天数，双方都能改</span>
          </div>
          <div class="mt-2">
            <AppDatePicker v-model="meetDate" placeholder="选择相识日期" />
          </div>
          <div class="mt-3 flex justify-end gap-2">
            <button class="btn-ghost !min-h-9 !px-4 !py-1.5 text-sm" :disabled="meetBusy" @click="editMeet = false">取消</button>
            <button class="btn-primary !min-h-9 !px-4 !py-1.5 text-sm" :disabled="meetBusy || !meetDate" @click="saveMeet">
              {{ meetBusy ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 未配对：展示配对码 -->
    <div v-if="!dash.partner" class="glass p-5 text-center">
       <p class="text-sm text-theme-secondary">等 Ta 注册时填写配对码，即可完成配对：</p>
      <div class="serif mt-2 text-2xl font-bold tracking-[0.4em] text-accent">{{ dash.inviteCode }}</div>
      <button class="btn-ghost mt-3" @click="copyInvite">复制配对码</button>
    </div>

    <section v-if="dash.careSummary && (dash.careSummary.periods?.length || dash.careSummary.alerts?.length)" class="glass p-5">
      <div class="mb-3 flex items-center justify-between"><h2 class="serif text-lg">💗 关怀提醒</h2><button class="text-xs text-accent" @click="router.push('/notebook')">去小本本 →</button></div>
      <div v-for="period in dash.careSummary.periods || []" :key="period.subject.id" class="mb-2 flex items-center justify-between gap-3 rounded-xl surface-soft px-3 py-2"><span class="text-sm">{{ period.subject.nickname }}的例假</span><span class="text-sm" :class="periodText(period).hot ? 'text-accent-2' : 'text-theme-secondary'">{{ periodText(period).text }}</span></div>
      <div class="flex flex-wrap gap-2"><span v-for="alert in dash.careSummary.alerts || []" :key="alert.id" class="rounded-full border border-current px-3 py-1.5 text-xs" :class="alert.severity === 'severe' ? 'danger-link' : 'text-accent-2'">⚠️ {{ alert.subject?.nickname }} · {{ alert.title }}</span></div>
    </section>

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
           <div class="mt-1 text-xs text-theme-tertiary">{{ c.label }} →</div>
        </div>
        <div class="glass col-span-2 flex cursor-pointer items-center justify-center p-4 transition-all hover:-translate-y-0.5 hover:bg-white/10"
          title="查看未读情书" @click="router.push('/letters')">
          <div class="text-center">
            <div class="text-2xl font-bold text-accent-2">{{ dash.stats.unreadLetters }}</div>
             <div class="mt-1 text-xs text-theme-tertiary">未读情书 →</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模块入口 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
      <button v-for="m in modules" :key="m.name" @click="router.push(`/${m.name}`)"
        class="glass group relative p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/10">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl text-lg" :style="{ background: m.color }">
            {{ m.icon }}
          </span>
          <div class="min-w-0">
            <div class="break-words font-medium">{{ m.label }}</div>
             <div class="break-words text-xs text-theme-tertiary">{{ m.desc }}</div>
          </div>
        </div>
        <span v-if="unreadOfModule(m.name)"
          class="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {{ unreadOfModule(m.name) }}
        </span>
      </button>
    </div>
  </div>
  <div v-else class="flex min-h-[50vh] items-center justify-center text-theme-tertiary">正在收拾小屋…</div>
</template>

<style scoped>
.meet-enter-active, .meet-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.meet-enter-from, .meet-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
