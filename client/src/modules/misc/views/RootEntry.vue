<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getObservatory } from '../../observatory/observatory.api.js'
import { isLoggedIn } from '../../../stores/session'
import Observatory from '../../observatory/views/Observatory.vue'

const router = useRouter()
const observatory = ref(null)
const loading = ref(true)

onMounted(async () => {
  if (isLoggedIn()) {
    await router.replace({ name: 'home' })
    return
  }

  try {
    const data = await getObservatory()
    if (data.photos?.length) observatory.value = data
    else await router.replace({ name: 'login' })
  } catch {
    // 公开观测台不可用时，不阻塞用户进入登录页。
    await router.replace({ name: 'login' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" class="flex min-h-[70svh] items-center justify-center">
    <div class="glass px-6 py-4 text-sm text-white/60" aria-live="polite">正在打开共鸣…</div>
  </div>

  <template v-else-if="observatory">
    <Observatory :initial-data="observatory" />
    <router-link
      to="/login"
      class="fixed bottom-6 right-5 z-40 rounded-full border border-white/25 bg-[rgb(var(--accent-rgb)/0.85)] px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)] shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:bg-[rgb(var(--accent-rgb)/0.95)] focus:outline-none focus:ring-2 focus:ring-white/70 sm:bottom-8 sm:right-8"
    >
      进入共鸣
    </router-link>
  </template>
</template>
