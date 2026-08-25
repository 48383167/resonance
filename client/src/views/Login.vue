<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { setLogin } from '../stores/session'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const showPw = ref(false)
const error = ref('')
const busy = ref(false)
const registeredCount = ref(-1)

onMounted(async () => {
  try {
    const state = await api.get('/api/auth/state')
    registeredCount.value = state.userCount
  } catch { /* 忽略 */ }
})

async function doLogin() {
  error.value = ''
  if (!username.value.trim() || !password.value) return (error.value = '请输入用户名和密码')
  busy.value = true
  try {
    const data = await api.post('/api/auth/login', { username: username.value.trim(), password: password.value })
    setLogin(data)
    router.push(route.query.redirect || '/home')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[80vh] items-center justify-center">
    <div class="glass w-full max-w-sm p-8 fade-up">
      <div class="text-center">
        <div class="text-4xl">♫</div>
        <h1 class="serif mt-2 text-2xl font-bold tracking-[0.3em]">共鸣</h1>
        <p class="mt-1 text-xs text-white/50">Resonance · 只属于两个人的恋爱日记</p>
      </div>

      <div class="mt-6 space-y-4">
        <div>
          <label class="mb-1 block text-xs text-white/50">用户名</label>
          <input v-model="username" class="input-dark" placeholder="3-20 位字母/数字/下划线"
            autocomplete="username" @keyup.enter="doLogin" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-white/50">密码</label>
          <div class="relative">
            <input v-model="password" :type="showPw ? 'text' : 'password'" class="input-dark pr-11"
              placeholder="你的密码" autocomplete="current-password" @keyup.enter="doLogin" />
            <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-base opacity-70 hover:opacity-100"
              :title="showPw ? '隐藏密码' : '显示密码'" @click="showPw = !showPw">
              {{ showPw ? '🙈' : '👁' }}
            </button>
          </div>
        </div>
        <button class="btn-primary w-full" :disabled="busy" @click="doLogin">
          {{ busy ? '正在登录…' : '登录' }}
        </button>
        <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>
        <div class="text-center text-sm text-white/50">
          <template v-if="registeredCount === 0">还没有账号？</template>
          <template v-else>想加入 Ta？</template>
          <router-link to="/register" class="text-violet-300 hover:underline">注册</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
