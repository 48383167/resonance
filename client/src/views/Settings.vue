<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { session, initSession } from '../stores/session'
import { toast } from '../stores/toast'
import ImageUpload from '../components/ImageUpload.vue'
import AppSelect from '../components/AppSelect.vue'

const nickname = ref('')
const avatarUrl = ref('')
const pw = ref({ old: '', next: '' })
const share = ref(null)
const shareForm = ref({ password: '', expireDays: 30 })

onMounted(async () => {
  if (!session.me) await initSession()
  nickname.value = session.me?.nickname || ''
  avatarUrl.value = session.me?.avatar_url || ''
  await loadShare()
})

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
        <div v-else class="flex h-12 w-12 items-center justify-center rounded-full bg-violet-400/20 text-lg">♫</div>
        <div>
          <div class="font-medium">{{ session.me?.nickname }} × {{ session.partner?.nickname || '…' }}</div>
          <div class="mt-0.5 text-xs text-white/45">
            {{ session.partner ? '已配对' : '等待 Ta 用配对码注册' }}
            <span v-if="!session.partner" class="ml-2 text-violet-200">{{ session.inviteCode }}</span>
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
            <span class="truncate">{{ location.origin }}{{ share.shareUrl }}</span>
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
