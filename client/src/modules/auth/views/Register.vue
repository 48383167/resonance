<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getState, register } from '../auth.api.js'
import { setLogin } from '../../../stores/session'

const router = useRouter()

const userCount = ref(-1)
const username = ref('')
const password = ref('')
const confirmPw = ref('')
const showPw = ref(false)
const nickname = ref('')
const inviteCode = ref('')
const error = ref('')
const busy = ref(false)

onMounted(async () => {
  try {
    const state = await getState()
    userCount.value = state.userCount
  } catch { /* 忽略 */ }
})

async function doRegister() {
  error.value = ''
  if (!username.value.trim()) return (error.value = '请输入用户名')
  if (!password.value || password.value.length < 6) return (error.value = '密码至少 6 位')
  if (password.value !== confirmPw.value) return (error.value = '两次输入的密码不一致')
  if (!nickname.value.trim()) return (error.value = '请输入昵称')
  if (userCount.value === 1 && !inviteCode.value.trim()) return (error.value = '请输入 Ta 给你的配对码')
  busy.value = true
  try {
    const data = await register({
      username: username.value.trim(),
      password: password.value,
      nickname: nickname.value.trim(),
      inviteCode: inviteCode.value.trim().toUpperCase() || undefined,
    })
    // 注册成功直接进入系统；第一人的配对码会显示在首页顶部
    setLogin(data)
    router.push('/home')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[80svh] items-start justify-center px-1 pt-8 sm:items-center sm:pt-0">
    <div class="glass w-full max-w-sm p-6 fade-up sm:p-8">
      <div class="text-center">
        <div class="text-4xl">♫</div>
        <h1 class="serif mt-2 text-2xl font-bold tracking-[0.3em]">共鸣</h1>
      </div>

      <!-- 已配对完成 -->
      <div v-if="userCount >= 2" class="mt-6 text-center text-sm text-white/60">
        <p>这间小屋已经住满两个人啦 🏠</p>
        <router-link to="/login" class="mt-3 inline-block text-accent hover:underline">去登录</router-link>
      </div>

      <!-- 注册表单 -->
      <div v-else-if="userCount !== -1" class="mt-6 space-y-4">
        <p v-if="userCount === 0" class="text-xs text-amber-200/80">你是第一个人：注册后生成配对码，等 Ta 凭码加入。</p>
        <p v-else class="text-xs text-accent-2">填上 Ta 给你的配对码，注册即完成配对。</p>
        <div>
          <label class="mb-1 block text-xs text-white/50">用户名</label>
          <input v-model="username" class="input-dark" placeholder="3-20 位字母/数字/下划线" autocomplete="username" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">密码</label>
          <div class="relative">
            <input v-model="password" :type="showPw ? 'text' : 'password'" class="input-dark pr-11"
              placeholder="至少 6 位" autocomplete="new-password" />
            <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-base opacity-70 hover:opacity-100"
              :title="showPw ? '隐藏密码' : '显示密码'" @click="showPw = !showPw">
              {{ showPw ? '🙈' : '👁' }}
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">确认密码</label>
          <input v-model="confirmPw" :type="showPw ? 'text' : 'password'" class="input-dark"
            placeholder="再输入一次" autocomplete="new-password" @keyup.enter="doRegister" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">昵称</label>
          <input v-model="nickname" class="input-dark" placeholder="Ta 叫你什么？" maxlength="12" />
        </div>
        <div v-if="userCount === 1">
          <label class="mb-1 block text-xs text-white/50">配对码（6 位）</label>
          <input v-model="inviteCode" class="input-dark text-center uppercase tracking-[0.4em]"
            placeholder="如 AB3K2M" maxlength="6" />
        </div>
        <button class="btn-primary w-full" :disabled="busy" @click="doRegister">
          {{ busy ? '正在注册…' : userCount === 0 ? '创建账号' : '注册并配对' }}
        </button>
        <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>
        <div class="text-center text-sm text-white/50">
          已有账号？<router-link to="/login" class="text-accent hover:underline">去登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
