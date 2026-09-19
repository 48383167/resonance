<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { updateProfile } from '../../../modules/misc/misc.api.js'
import { changePassword as changePasswordApi } from '../../../modules/auth/auth.api.js'
import { getCurrentShare, createShare as createShareApi, updateCurrentShare, disableShare as disableShareApi } from '../../../modules/share/share.api.js'
import { getMailSettings, updateMailSettings, sendTestMail, previewNotifications, runNotifications } from '../../../modules/notification/notification.api.js'
import { navigationItems } from '../../../shared/navigation.js'
import { dock, DEFAULT_DOCK_ITEMS, loadDock, applyDock } from '../../../stores/dock'
import { updateNavigation } from '../../../modules/navigation/navigation.api.js'
import { session, initSession } from '../../../stores/session'
import { toast } from '../../../stores/toast'
import { applyTheme, currentTheme, loadTheme, saveTheme } from '../../../stores/theme'
import { THEME_PRESETS, normalizeTheme, presetConfig } from '../../../theme/presets'
import ImageUpload from '../../../shared/components/ImageUpload.vue'
import AppSelect from '../../../shared/components/AppSelect.vue'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'

const nickname = ref('')
const gender = ref('')
const avatarUrl = ref('')
const mailSettings = ref({ mailerConfigured: false, aiConfigured: false })
const mailForm = ref({ email: '', periodRemind: false, anniversaryRemind: false, aiContent: true })
const mailSaving = ref(false)
const mailTesting = ref(false)
const mailRunning = ref(false)
const previewLoading = ref(false)
const mailPreviewType = ref('period')
const previews = ref([])
const dockDraft = ref([...dock.items])
const dockSaving = ref(false)
const MAX_DOCK_ITEMS = 5

// 设置分 Tab，避免长页面滚动；记住上次停留的位置
const SETTINGS_TABS = [
  { value: 'profile', label: '资料', icon: '👤' },
  { value: 'notify', label: '提醒', icon: '✉️' },
  { value: 'nav', label: '导航', icon: '🧭' },
  { value: 'theme', label: '主题', icon: '🎨' },
  { value: 'share', label: '分享', icon: '🔗' },
]
const SETTINGS_TAB_KEY = 'resonance.settings.tab'
const savedTab = localStorage.getItem(SETTINGS_TAB_KEY)
const settingsTab = ref(SETTINGS_TABS.some((t) => t.value === savedTab) ? savedTab : 'profile')
watch(settingsTab, (value) => {
  localStorage.setItem(SETTINGS_TAB_KEY, value)
  window.scrollTo({ top: 0 })
})

const dockAvailable = computed(() =>
  navigationItems.filter((item) => !dockDraft.value.includes(item.name)))

function dockItemMeta(name) {
  return navigationItems.find((item) => item.name === name) || { label: name, icon: '·' }
}

function moveDock(index, delta) {
  const to = index + delta
  if (to < 0 || to >= dockDraft.value.length) return
  const next = [...dockDraft.value]
  ;[next[index], next[to]] = [next[to], next[index]]
  dockDraft.value = next
}

function removeDockItem(index) {
  if (dockDraft.value.length <= 1) return toast('至少要保留一个入口')
  dockDraft.value = dockDraft.value.filter((_, i) => i !== index)
}

function addDockItem(name) {
  if (dockDraft.value.length >= MAX_DOCK_ITEMS) return toast('最多 5 个入口')
  if (dockDraft.value.includes(name)) return
  dockDraft.value = [...dockDraft.value, name]
}

function resetDockDraft() {
  dockDraft.value = [...DEFAULT_DOCK_ITEMS]
}

async function saveDockSettings() {
  if (dockSaving.value) return
  dockSaving.value = true
  try {
    const data = await updateNavigation(dockDraft.value)
    applyDock(data?.items)
    dockDraft.value = [...dock.items]
    toast('底部导航已保存')
  } catch (e) {
    toast(e.message)
  } finally {
    dockSaving.value = false
  }
}
const pw = ref({ old: '', next: '' })
const share = ref(null)
const shareForm = ref({ password: '', expireDays: 30, includeMoments: true, includeEntries: true, includeAnniversaries: true, includeFoods: true })
const locationOrigin = globalThis.location.origin
const themeDraft = ref(normalizeTheme(currentTheme))
const themeSaving = ref(false)
const detailOpen = ref(false)
const creatingShare = ref(false)
let createShareKey = null
const appearanceOptions = [
  { value: 'auto', label: '自动（跟随氛围色）' },
  { value: 'light', label: '明亮' },
  { value: 'dark', label: '暗色' },
]
const detailFallbacks = {
  surfaceColor: '#ffffff',
  surfaceStrongColor: '#ffffff',
  textColor: '#302b43',
  mutedTextColor: '#6e667b',
  borderColor: '#302b43',
}
const detailOptions = [
  { key: 'surfaceColor', label: '内容容器背景' },
  { key: 'surfaceStrongColor', label: '强化容器/浮层背景' },
  { key: 'textColor', label: '主文字色' },
  { key: 'mutedTextColor', label: '次文字色' },
  { key: 'borderColor', label: '边框色' },
]
const shareOptions = [
  { key: 'includeMoments', label: '恋爱瞬间', icon: '📷', description: '照片与当时写下的心情' },
  { key: 'includeEntries', label: '公开日记', icon: '📝', description: '标记为公开的文字日记' },
  { key: 'includeAnniversaries', label: '纪念日', icon: '🌷', description: '一起珍藏的重要日期' },
  { key: 'includeFoods', label: '美食', icon: '🍜', description: '去过和常去的店与招牌菜' },
]
const GENDERS = [
  { value: '', label: '不填' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]

onMounted(async () => {
  if (!session.me) await initSession()
  if (session.me) await loadTheme(session.me.id)
  nickname.value = session.me?.nickname || ''
  gender.value = session.me?.gender || ''
  avatarUrl.value = session.me?.avatar_url
    ? { id: session.me.avatar_file_id || '', url: session.me.avatar_url, type: 'image', name: '头像' }
    : ''
  themeDraft.value = normalizeTheme(currentTheme)
  await loadShare()
  await loadMailSettings()
  await loadDock()
  dockDraft.value = [...dock.items]
})

function previewTheme() {
  applyTheme(themeDraft.value)
}

function choosePreset(preset) {
  themeDraft.value = presetConfig(preset)
  previewTheme()
}

function markCustom() {
  themeDraft.value.themeKey = 'custom'
  previewTheme()
}

function setAppearanceMode() {
  themeDraft.value.themeKey = 'custom'
  previewTheme()
}

function detailValue(key) {
  return themeDraft.value[key] || detailFallbacks[key]
}

function setDetailColor(key, event) {
  themeDraft.value[key] = event.target.value
  markCustom()
}

function clearDetails() {
  Object.keys(detailFallbacks).forEach((key) => { themeDraft.value[key] = null })
  markCustom()
}

async function saveThemeSettings() {
  if (!session.me || themeSaving.value) return
  themeSaving.value = true
  try {
    const saved = await saveTheme(themeDraft.value, session.me.id)
    themeDraft.value = normalizeTheme(saved)
    toast('主题已保存')
  } catch (e) {
    themeDraft.value = normalizeTheme(currentTheme)
    toast(e.message)
  } finally {
    themeSaving.value = false
  }
}

async function saveProfile() {
  if (!nickname.value.trim()) return toast('昵称不能为空')
  const me = await updateProfile({ nickname: nickname.value.trim(), gender: gender.value, avatarFileId: avatarUrl.value?.id || null })
  session.me = me
  toast('资料已保存')
}

// —— 邮件提醒 ——
async function loadMailSettings() {
  try {
    const data = await getMailSettings()
    mailSettings.value = data
    mailForm.value = {
      email: data.email || '',
      periodRemind: data.periodRemind,
      anniversaryRemind: data.anniversaryRemind,
      aiContent: data.aiContent,
    }
  } catch (e) {
    toast(e.message)
  }
}

async function saveMail() {
  if (mailSaving.value) return
  mailSaving.value = true
  try {
    const data = await updateMailSettings({ ...mailForm.value })
    mailSettings.value = data
    toast('邮件设置已保存')
  } catch (e) {
    toast(e.message)
  } finally {
    mailSaving.value = false
  }
}

async function testMail() {
  if (mailTesting.value) return
  mailTesting.value = true
  try {
    await sendTestMail(generateIdempotencyKey())
    toast('测试邮件已发送，请查收')
  } catch (e) {
    toast(e.message)
  } finally {
    mailTesting.value = false
  }
}

// 手动触发一次提醒检查（与定时调度同一套去重规则）
async function runMailCheck() {
  if (mailRunning.value) return
  mailRunning.value = true
  try {
    const data = await runNotifications(generateIdempotencyKey())
    if (data.skipped === 'MAIL_NOT_CONFIGURED') toast('服务器未配置 SMTP，无法发送')
    else if (data.failed) toast(`发送完成：成功 ${data.sent} 封，失败 ${data.failed} 封`)
    else if (data.sent) toast(`已发送 ${data.sent} 封提醒邮件`)
    else toast('暂时没有到期的提醒')
  } catch (e) {
    toast(e.message)
  } finally {
    mailRunning.value = false
  }
}

async function loadPreview(type) {
  mailPreviewType.value = type
  previewLoading.value = true
  try {
    const data = await previewNotifications(type)
    previews.value = data.items || []
    if (!previews.value.length) toast('暂时没有可预览的内容')
  } catch (e) {
    toast(e.message)
  } finally {
    previewLoading.value = false
  }
}

async function changePassword() {
  if (!pw.value.old || !pw.value.next) return toast('请填写原密码和新密码')
  if (pw.value.next.length < 6) return toast('新密码至少 6 位')
  try {
    await changePasswordApi({ oldPassword: pw.value.old, newPassword: pw.value.next })
    pw.value = { old: '', next: '' }
    toast('密码已修改')
  } catch (e) {
    toast(e.message)
  }
}

async function loadShare() {
  try {
    share.value = await getCurrentShare()
    syncShareForm(share.value)
  } catch { /* 忽略 */ }
}

function syncShareForm(value) {
  if (!value) return
  shareForm.value.includeMoments = value.includeMoments !== false
  shareForm.value.includeEntries = value.includeEntries !== false
  shareForm.value.includeAnniversaries = value.includeAnniversaries !== false
  shareForm.value.includeFoods = value.includeFoods !== false
}

async function createShare() {
  if (creatingShare.value) return
  creatingShare.value = true
  try {
    createShareKey ||= generateIdempotencyKey()
    const data = await createShareApi({
      password: shareForm.value.password,
      expireDays: Number(shareForm.value.expireDays),
      includeMoments: shareForm.value.includeMoments,
      includeEntries: shareForm.value.includeEntries,
      includeAnniversaries: shareForm.value.includeAnniversaries,
      includeFoods: shareForm.value.includeFoods,
    }, createShareKey)
    createShareKey = null
    share.value = data
    syncShareForm(data)
    // 生成后自动复制链接
    const url = location.origin + data.shareUrl
    try {
      await navigator.clipboard.writeText(url)
      toast('分享链接已生成并复制到剪贴板 🔗')
    } catch {
      toast('分享链接已生成')
    }
  } catch (e) {
    toast(e.message)
  } finally {
    creatingShare.value = false
  }
}

async function saveShareContent() {
  try {
    const updated = await updateCurrentShare({
      includeMoments: shareForm.value.includeMoments,
      includeEntries: shareForm.value.includeEntries,
      includeAnniversaries: shareForm.value.includeAnniversaries,
      includeFoods: shareForm.value.includeFoods,
    })
    share.value = updated
    syncShareForm(updated)
    toast('分享内容已保存')
  } catch (e) {
    toast(e.message)
  }
}

async function disableShare() {
  await disableShareApi()
  share.value = null
  toast('分享已停用')
}

function copyShare() {
  const url = location.origin + share.value.shareUrl
  navigator.clipboard?.writeText(url).catch(() => {})
  toast('链接已复制')
}
</script>

<template>
  <div class="fade-up space-y-5">
    <h2 class="serif text-xl">设置</h2>

    <div class="surface-soft flex gap-1 overflow-x-auto rounded-2xl p-1">
      <button v-for="t in SETTINGS_TABS" :key="t.value"
        class="min-h-11 shrink-0 flex-1 rounded-xl px-2 text-xs transition-colors sm:text-sm"
        :class="settingsTab === t.value ? 'bg-accent-soft text-accent' : 'text-white/60'"
        @click="settingsTab = t.value">
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <!-- 配对信息 -->
    <div v-if="settingsTab === 'profile'" class="glass p-5 text-sm">
      <div class="flex min-w-0 items-center gap-3">
        <img v-if="session.me?.avatar_url" :src="session.me.avatar_url" class="h-12 w-12 rounded-full object-cover" />
        <div v-else class="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-lg">♫</div>
        <div class="min-w-0">
          <div class="break-words font-medium">{{ session.me?.nickname }} × {{ session.partner?.nickname || '…' }}</div>
          <div class="mt-0.5 text-xs text-white/45">
            {{ session.partner ? '已配对' : '等待 Ta 用配对码注册' }}
            <span v-if="!session.partner" class="ml-2 text-accent">{{ session.inviteCode }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 资料 -->
    <div v-if="settingsTab === 'profile'" class="glass space-y-3 p-5">
      <h3 class="text-sm text-white/70">个人资料</h3>
      <div>
        <label class="mb-1 block text-xs text-white/50">昵称</label>
        <input v-model="nickname" class="input-dark" maxlength="12" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-white/50">性别</label>
        <AppSelect v-model="gender" :options="GENDERS" placeholder="选择性别" />
        <p class="mt-1 text-xs text-white/40">一方填写后，对方自动同步为相反性别；用于例假记录默认到女性一方</p>
      </div>
      <div>
        <label class="mb-1 block text-xs text-white/50">头像</label>
        <ImageUpload v-model="avatarUrl" :multiple="false" accept="image" />
      </div>
      <button class="btn-primary w-full sm:w-auto" @click="saveProfile">保存资料</button>
    </div>

    <!-- 邮件提醒：QQ 邮箱 SMTP，例假与纪念日通知 -->
    <div v-if="settingsTab === 'notify'" class="glass space-y-4 p-5">
      <div>
        <h3 class="text-sm text-white/70">邮件提醒</h3>
        <p class="mt-1 text-xs text-white/45">例假预计前 3 天、纪念日提前 3 天与当天，会向下面的邮箱发送提醒；正文可由 AI 生成，也可以使用内置文案。</p>
      </div>

      <div v-if="!mailSettings.mailerConfigured"
        class="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
        服务器还没配置 QQ 邮箱 SMTP：请在服务器 .env 中填写 SMTP_USER 与 SMTP_PASS（邮箱授权码）后重启，配置步骤见 docs/api/notification.md。
      </div>

      <div>
        <label class="mb-1 block text-xs text-white/50">收件邮箱</label>
        <input v-model="mailForm.email" class="input-dark" placeholder="xxx@qq.com" maxlength="120" />
      </div>

      <div class="space-y-2">
        <button class="surface-soft flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-sm"
          @click="mailForm.periodRemind = !mailForm.periodRemind">
          <span>例假临近提醒</span>
          <span :class="mailForm.periodRemind ? 'text-accent' : 'text-white/40'">{{ mailForm.periodRemind ? '已开启' : '已关闭' }}</span>
        </button>
        <button class="surface-soft flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-sm"
          @click="mailForm.anniversaryRemind = !mailForm.anniversaryRemind">
          <span>纪念日提醒</span>
          <span :class="mailForm.anniversaryRemind ? 'text-accent' : 'text-white/40'">{{ mailForm.anniversaryRemind ? '已开启' : '已关闭' }}</span>
        </button>
        <button class="surface-soft flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-sm"
          @click="mailForm.aiContent = !mailForm.aiContent">
          <span>AI 生成邮件文案</span>
          <span :class="mailForm.aiContent ? 'text-accent' : 'text-white/40'">{{ mailForm.aiContent ? '已开启' : '已关闭' }}</span>
        </button>
      </div>
      <p v-if="mailForm.aiContent" class="text-xs text-white/40">开启 AI 后，例假/纪念日信息会发送给 DeepSeek 生成文案；关闭则使用内置温暖文案。</p>
      <p v-if="!mailSettings.aiConfigured" class="text-xs text-white/40">服务器未配置 DEEPSEEK_API_KEY，将直接使用内置文案。</p>

      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button class="btn-primary w-full sm:w-auto" :disabled="mailSaving" @click="saveMail">
          {{ mailSaving ? '保存中…' : '保存邮件设置' }}
        </button>
        <button class="btn-ghost w-full sm:w-auto" :disabled="mailTesting" @click="testMail">
          {{ mailTesting ? '发送中…' : '发送测试邮件' }}
        </button>
        <button class="btn-ghost w-full sm:w-auto" :disabled="mailRunning" @click="runMailCheck">
          {{ mailRunning ? '检查中…' : '立即检查并发送' }}
        </button>
        <button class="btn-ghost w-full sm:w-auto" :disabled="previewLoading" @click="loadPreview(mailPreviewType)">
          {{ previewLoading ? '生成中…' : '预览提醒内容' }}
        </button>
      </div>

      <div v-if="previews.length" class="space-y-3">
        <div class="flex gap-2">
          <button v-for="t in [{ value: 'period', label: '例假' }, { value: 'anniversary', label: '纪念日' }]" :key="t.value"
            class="min-h-10 rounded-full px-3 text-xs transition-colors"
            :class="mailPreviewType === t.value ? 'bg-accent-soft text-accent' : 'surface-soft text-white/60'"
            @click="loadPreview(t.value)">
            {{ t.label }}
          </button>
        </div>
        <div v-for="(item, i) in previews" :key="i" class="surface-soft rounded-xl p-3 text-sm">
          <div class="text-xs text-white/45">
            收件人：{{ item.recipient.nickname }}
            <template v-if="item.role">· {{ item.role === 'self' ? '例假本人' : '伴侣' }}</template>
            · {{ item.source === 'ai' ? 'AI 生成' : '内置文案' }}
          </div>
          <div class="mt-1 font-medium">{{ item.subject }}</div>
          <p class="mt-1 whitespace-pre-wrap text-white/70">{{ item.body }}</p>
        </div>
      </div>
    </div>

    <!-- 底部导航：两人共用的统一设置 -->
    <div v-if="settingsTab === 'nav'" class="glass space-y-4 p-5">
      <div>
        <h3 class="text-sm text-white/70">底部导航</h3>
        <p class="mt-1 text-xs text-white/45">选择底栏显示的入口与顺序（最多 5 个）；这是两人共用的设置，保存后对方也会同步。</p>
      </div>

      <div class="space-y-2">
        <div v-for="(name, index) in dockDraft" :key="name"
          class="surface-soft flex min-h-11 items-center gap-2 rounded-xl px-3">
          <span>{{ dockItemMeta(name).icon }}</span>
          <span class="min-w-0 flex-1 truncate text-sm">{{ dockItemMeta(name).label }}</span>
          <button class="min-h-11 min-w-9 rounded-lg text-white/60 transition-colors hover:text-white disabled:opacity-30"
            :disabled="index === 0" aria-label="上移" @click="moveDock(index, -1)">↑</button>
          <button class="min-h-11 min-w-9 rounded-lg text-white/60 transition-colors hover:text-white disabled:opacity-30"
            :disabled="index === dockDraft.length - 1" aria-label="下移" @click="moveDock(index, 1)">↓</button>
          <button class="min-h-11 min-w-9 rounded-lg text-xs danger-link" aria-label="移除" @click="removeDockItem(index)">✕</button>
        </div>
      </div>

      <div v-if="dockAvailable.length">
        <div class="mb-1 text-xs text-white/45">可添加（{{ dockDraft.length }}/5）</div>
        <div class="flex flex-wrap gap-2">
          <button v-for="item in dockAvailable" :key="item.name"
            class="border-theme min-h-10 rounded-full border px-3 text-xs text-white/70 transition-colors hover:bg-white/10 disabled:opacity-30"
            :disabled="dockDraft.length >= MAX_DOCK_ITEMS" @click="addDockItem(item.name)">
            ＋ {{ item.icon }} {{ item.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row">
        <button class="btn-primary w-full sm:w-auto" :disabled="dockSaving" @click="saveDockSettings">
          {{ dockSaving ? '保存中…' : '保存导航设置' }}
        </button>
        <button class="btn-ghost w-full sm:w-auto" @click="resetDockDraft">恢复默认</button>
      </div>
    </div>

    <!-- 个人主题：只保存到当前登录用户，不会影响伴侣 -->
    <div v-if="settingsTab === 'theme'" class="glass space-y-4 p-5">
      <div>
        <h3 class="text-sm text-white/70">主题色</h3>
        <p class="mt-1 text-xs text-white/45">主题属于当前账号，选择后会实时预览，保存后可在其他设备恢复。</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <button v-for="preset in THEME_PRESETS" :key="preset.key" type="button"
          class="rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5"
          :aria-pressed="themeDraft.themeKey === preset.key"
          :class="themeDraft.themeKey === preset.key ? 'border-accent ring-1 ring-accent' : 'border-white/10'"
          :style="{ background: `linear-gradient(135deg, ${preset.ambientColor}, ${preset.ambientColor} 55%, ${preset.primaryColor}35)` }"
          @click="choosePreset(preset)">
          <span class="flex items-center gap-2">
            <i class="h-4 w-4 rounded-full" :style="{ background: preset.primaryColor, boxShadow: `0 0 12px ${preset.primaryColor}` }" />
            <b class="text-sm">{{ preset.name }}</b>
          </span>
          <span class="mt-1 block text-xs text-white/50">{{ preset.description }}</span>
          <span class="mt-3 flex gap-1.5">
            <i v-for="color in [preset.primaryColor, preset.secondaryColor, preset.ambientColor]" :key="color"
              class="h-3 w-3 rounded-full ring-1 ring-white/20" :style="{ background: color }" />
          </span>
        </button>
      </div>

      <div class="rounded-2xl border border-white/10 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-medium">自由配色</div>
            <div class="mt-1 text-xs text-white/45">颜色可以自由组合，页面会自动适配明暗基底。</div>
          </div>
          <span class="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">{{ themeDraft.themeKey === 'custom' ? '自定义' : '预置主题' }}</span>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <label class="flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
            <input v-model="themeDraft.primaryColor" type="color" class="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" @input="markCustom" />
            <span class="min-w-0 break-words">主色<br /><b class="text-white/85">{{ themeDraft.primaryColor }}</b></span>
          </label>
          <label class="flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
            <input v-model="themeDraft.secondaryColor" type="color" class="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" @input="markCustom" />
            <span class="min-w-0 break-words">辅助色<br /><b class="text-white/85">{{ themeDraft.secondaryColor }}</b></span>
          </label>
          <label class="flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
            <input v-model="themeDraft.ambientColor" type="color" class="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" @input="markCustom" />
            <span class="min-w-0 break-words">氛围色<br /><b class="text-white/85">{{ themeDraft.ambientColor }}</b></span>
          </label>
        </div>
      </div>

      <div class="rounded-2xl border border-white/10 p-4">
        <button type="button" class="flex w-full items-center justify-between text-left" @click="detailOpen = !detailOpen">
          <span>
            <span class="block text-sm font-medium">主题细节</span>
            <span class="mt-1 block text-xs text-white/45">分别调整整体明暗、内容容器、文字和边框颜色。</span>
          </span>
          <span class="text-xs text-white/50">{{ detailOpen ? '收起 ↑' : '展开 ↓' }}</span>
        </button>
        <div v-if="detailOpen" class="mt-4 space-y-4">
          <div>
            <label class="mb-1 block text-xs text-white/50">整体基底</label>
            <AppSelect v-model="themeDraft.appearanceMode" :options="appearanceOptions" @update:model-value="setAppearanceMode" />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
             <label v-for="item in detailOptions" :key="item.key" class="flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
               <input type="color" class="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                 :value="detailValue(item.key)" @input="setDetailColor(item.key, $event)" />
               <span class="min-w-0 break-words">{{ item.label }}<br /><b class="text-white/85">{{ themeDraft[item.key] || '自动生成' }}</b></span>
            </label>
          </div>
          <button type="button" class="btn-ghost text-sm" @click="clearDetails">恢复自动配色</button>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl p-4" :style="{
        background: `linear-gradient(135deg, ${themeDraft.primaryColor}, ${themeDraft.secondaryColor})`,
        color: currentTheme.accentContrast,
      }">
        <div class="text-xs opacity-70">主题预览</div>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span class="serif text-lg font-semibold">我们的专属色</span>
          <button type="button" class="rounded-full bg-black/15 px-3 py-1.5 text-xs" @click="previewTheme">应用预览</button>
        </div>
      </div>
      <button class="btn-primary w-full sm:w-auto" :disabled="themeSaving" @click="saveThemeSettings">
        {{ themeSaving ? '保存中…' : '保存主题' }}
      </button>
    </div>

    <!-- 修改密码 -->
    <div v-if="settingsTab === 'profile'" class="glass space-y-3 p-5">
      <h3 class="text-sm text-white/70">修改密码</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <input v-model="pw.old" type="password" class="input-dark" placeholder="原密码" autocomplete="current-password" />
        <input v-model="pw.next" type="password" class="input-dark" placeholder="新密码（至少 6 位）" autocomplete="new-password" />
      </div>
       <button class="btn-primary w-full sm:w-auto" @click="changePassword">修改密码</button>
    </div>

    <!-- 分享 -->
    <div v-if="settingsTab === 'share'" class="glass relative z-20 space-y-3 p-5">
      <h3 class="text-sm text-white/70">对外分享（只读）</h3>
      <div v-if="share">
        <div class="rounded-xl bg-white/5 p-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-white/60">🔗</span>
             <span class="break-anywhere min-w-0">{{ locationOrigin }}{{ share.shareUrl }}</span>
          </div>
          <div class="mt-1 text-xs text-white/45">
            浏览 {{ share.viewCount }} 次
            <span v-if="share.hasPassword"> · 有密码</span>
            <span v-if="share.expiresAt"> · 有效期至 {{ new Date(share.expiresAt).toLocaleDateString('zh-CN') }}</span>
            <span v-else> · 永久有效</span>
          </div>
         </div>
         <div class="mt-4 rounded-2xl border border-accent/20 bg-accent-soft/30 p-4">
           <div class="flex flex-wrap items-start justify-between gap-2">
             <div>
               <h4 class="text-sm font-semibold text-white/85">分享内容</h4>
               <p class="mt-1 text-xs text-white/50">选择访客在恋爱剪贴簿中可以看到的内容</p>
             </div>
             <span class="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-accent">可随时调整</span>
           </div>
           <div class="mt-3 grid gap-2 sm:grid-cols-3">
             <button v-for="item in shareOptions" :key="item.key" type="button"
               class="min-w-0 rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
               :class="shareForm[item.key] ? 'border-accent bg-accent/10' : 'border-white/10 bg-black/10 opacity-75'"
               :aria-pressed="shareForm[item.key]" @click="shareForm[item.key] = !shareForm[item.key]">
               <span class="flex items-center gap-2 text-sm"><span>{{ item.icon }}</span><b class="truncate">{{ item.label }}</b></span>
               <span class="mt-1 block text-[11px] text-white/50">{{ shareForm[item.key] ? '将展示' : '不展示' }} · {{ item.description }}</span>
             </button>
           </div>
           <button class="btn-primary mt-3 w-full sm:w-auto" @click="saveShareContent">保存分享内容</button>
         </div>
         <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-3">
           <button class="btn-primary w-full sm:w-auto" @click="copyShare">复制链接</button>
           <button class="btn-ghost w-full sm:w-auto" @click="disableShare">停用分享</button>
        </div>
      </div>
      <div v-else class="space-y-3">
        <p class="text-xs text-white/50">生成一个只读链接，亲友无需登录即可看到我们的瞬间与公开日记。</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <input v-model="shareForm.password" class="input-dark" placeholder="访问密码（可留空）" />
          <AppSelect v-model="shareForm.expireDays" :options="[
            { value: 7, label: '7 天有效' },
            { value: 30, label: '30 天有效' },
            { value: 90, label: '90 天有效' },
            { value: 0, label: '永久有效' },
          ]" />
         </div>
        <div class="rounded-2xl border border-accent/20 bg-accent-soft/30 p-4">
          <h4 class="text-sm font-semibold text-white/85">分享内容</h4>
          <p class="mt-1 text-xs text-white/50">生成前选择剪贴簿中要展示的类别</p>
          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <button v-for="item in shareOptions" :key="item.key" type="button"
              class="min-w-0 rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
              :class="shareForm[item.key] ? 'border-accent bg-accent/10' : 'border-white/10 bg-black/10 opacity-75'"
              :aria-pressed="shareForm[item.key]" @click="shareForm[item.key] = !shareForm[item.key]">
              <span class="flex items-center gap-2 text-sm"><span>{{ item.icon }}</span><b class="truncate">{{ item.label }}</b></span>
              <span class="mt-1 block text-[11px] text-white/50">{{ shareForm[item.key] ? '将展示' : '不展示' }}</span>
            </button>
           </div>
         </div>
          <button class="btn-primary w-full sm:w-auto" :disabled="creatingShare" @click="createShare">
            {{ creatingShare ? '生成中…' : '生成分享链接' }}
          </button>
       </div>
    </div>

    <!-- 数据 -->
    <div v-if="settingsTab === 'share'" class="glass space-y-3 p-5">
      <h3 class="text-sm text-white/70">数据</h3>
      <p class="text-xs text-white/50">导出时光机：database.sqlite + 媒体文件夹打包为 zip 下载保存。</p>
      <a href="/api/export" class="btn-ghost inline-block">⬇ 导出时光机</a>
    </div>
  </div>
</template>
