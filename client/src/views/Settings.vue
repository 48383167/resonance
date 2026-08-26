<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { session, initSession } from '../stores/session'
import { toast } from '../stores/toast'
import { applyTheme, currentTheme, loadTheme, saveTheme } from '../stores/theme'
import { THEME_PRESETS, normalizeTheme, presetConfig } from '../theme/presets'
import ImageUpload from '../components/ImageUpload.vue'
import AppSelect from '../components/AppSelect.vue'

const nickname = ref('')
const avatarUrl = ref('')
const pw = ref({ old: '', next: '' })
const share = ref(null)
const shareForm = ref({ password: '', expireDays: 30 })
const locationOrigin = globalThis.location.origin
const themeDraft = ref(normalizeTheme(currentTheme))
const themeSaving = ref(false)
const detailOpen = ref(false)
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

onMounted(async () => {
  if (!session.me) await initSession()
  if (session.me) await loadTheme(session.me.id)
  nickname.value = session.me?.nickname || ''
  avatarUrl.value = session.me?.avatar_url || ''
  themeDraft.value = normalizeTheme(currentTheme)
  await loadShare()
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
  const me = await api.put('/api/users/me', { nickname: nickname.value.trim(), avatarUrl: avatarUrl.value || null })
  session.me = me
  toast('资料已保存')
}

async function changePassword() {
  if (!pw.value.old || !pw.value.next) return toast('请填写原密码和新密码')
  if (pw.value.next.length < 6) return toast('新密码至少 6 位')
  try {
    await api.post('/api/auth/change-password', { oldPassword: pw.value.old, newPassword: pw.value.next })
    pw.value = { old: '', next: '' }
    toast('密码已修改')
  } catch (e) {
    toast(e.message)
  }
}

async function loadShare() {
  try {
    share.value = await api.get('/api/share/current')
  } catch { /* 忽略 */ }
}

async function createShare() {
  try {
    const data = await api.post('/api/share/create', {
      password: shareForm.value.password,
      expireDays: Number(shareForm.value.expireDays),
    })
    share.value = { ...data, hasPassword: Boolean(shareForm.value.password), viewCount: 0 }
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
  }
}

async function disableShare() {
  await api.delete('/api/share/current')
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

    <!-- 配对信息 -->
    <div class="glass p-5 text-sm">
      <div class="flex items-center gap-3">
        <img v-if="session.me?.avatar_url" :src="session.me.avatar_url" class="h-12 w-12 rounded-full object-cover" />
        <div v-else class="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-lg">♫</div>
        <div>
          <div class="font-medium">{{ session.me?.nickname }} × {{ session.partner?.nickname || '…' }}</div>
          <div class="mt-0.5 text-xs text-white/45">
            {{ session.partner ? '已配对' : '等待 Ta 用配对码注册' }}
            <span v-if="!session.partner" class="ml-2 text-accent">{{ session.inviteCode }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 资料 -->
    <div class="glass space-y-3 p-5">
      <h3 class="text-sm text-white/70">个人资料</h3>
      <div>
        <label class="mb-1 block text-xs text-white/50">昵称</label>
        <input v-model="nickname" class="input-dark" maxlength="12" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-white/50">头像</label>
        <ImageUpload v-model="avatarUrl" :multiple="false" accept="image" />
      </div>
      <button class="btn-primary" @click="saveProfile">保存资料</button>
    </div>

    <!-- 个人主题：只保存到当前登录用户，不会影响伴侣 -->
    <div class="glass space-y-4 p-5">
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
          <div>
            <div class="text-sm font-medium">自由配色</div>
            <div class="mt-1 text-xs text-white/45">颜色可以自由组合，页面会自动适配明暗基底。</div>
          </div>
          <span class="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">{{ themeDraft.themeKey === 'custom' ? '自定义' : '预置主题' }}</span>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <label class="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
            <input v-model="themeDraft.primaryColor" type="color" class="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" @input="markCustom" />
            <span>主色<br /><b class="text-white/85">{{ themeDraft.primaryColor }}</b></span>
          </label>
          <label class="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
            <input v-model="themeDraft.secondaryColor" type="color" class="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" @input="markCustom" />
            <span>辅助色<br /><b class="text-white/85">{{ themeDraft.secondaryColor }}</b></span>
          </label>
          <label class="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
            <input v-model="themeDraft.ambientColor" type="color" class="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" @input="markCustom" />
            <span>氛围色<br /><b class="text-white/85">{{ themeDraft.ambientColor }}</b></span>
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
            <label v-for="item in detailOptions" :key="item.key" class="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/65">
              <input type="color" class="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                :value="detailValue(item.key)" @input="setDetailColor(item.key, $event)" />
              <span>{{ item.label }}<br /><b class="text-white/85">{{ themeDraft[item.key] || '自动生成' }}</b></span>
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
        <div class="mt-2 flex items-center justify-between gap-3">
          <span class="serif text-lg font-semibold">我们的专属色</span>
          <button type="button" class="rounded-full bg-black/15 px-3 py-1.5 text-xs" @click="previewTheme">应用预览</button>
        </div>
      </div>
      <button class="btn-primary" :disabled="themeSaving" @click="saveThemeSettings">
        {{ themeSaving ? '保存中…' : '保存主题' }}
      </button>
    </div>

    <!-- 修改密码 -->
    <div class="glass space-y-3 p-5">
      <h3 class="text-sm text-white/70">修改密码</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <input v-model="pw.old" type="password" class="input-dark" placeholder="原密码" autocomplete="current-password" />
        <input v-model="pw.next" type="password" class="input-dark" placeholder="新密码（至少 6 位）" autocomplete="new-password" />
      </div>
      <button class="btn-primary" @click="changePassword">修改密码</button>
    </div>

    <!-- 分享 -->
    <div class="glass relative z-20 space-y-3 p-5">
      <h3 class="text-sm text-white/70">对外分享（只读）</h3>
      <div v-if="share">
        <div class="rounded-xl bg-white/5 p-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-white/60">🔗</span>
            <span class="truncate">{{ locationOrigin }}{{ share.shareUrl }}</span>
          </div>
          <div class="mt-1 text-xs text-white/45">
            浏览 {{ share.viewCount }} 次
            <span v-if="share.hasPassword"> · 有密码</span>
            <span v-if="share.expiresAt"> · 有效期至 {{ new Date(share.expiresAt).toLocaleDateString('zh-CN') }}</span>
            <span v-else> · 永久有效</span>
          </div>
        </div>
        <div class="mt-3 flex gap-3">
          <button class="btn-primary" @click="copyShare">复制链接</button>
          <button class="btn-ghost" @click="disableShare">停用分享</button>
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
          <button class="btn-primary" @click="createShare">生成分享链接</button>
        </div>
      </div>
    </div>

    <!-- 数据 -->
    <div class="glass space-y-3 p-5">
      <h3 class="text-sm text-white/70">数据</h3>
      <p class="text-xs text-white/50">导出时光机：database.sqlite + 媒体文件夹打包为 zip 下载保存。</p>
      <a href="/api/export" class="btn-ghost inline-block">⬇ 导出时光机</a>
    </div>
  </div>
</template>
