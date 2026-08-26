<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getPublicShare } from '../../../modules/observatory/observatory.api.js'

// 公开分享页：token 只读访问，可选密码
const route = useRoute()
const data = ref(null)
const error = ref('')
const needPassword = ref(false)
const password = ref('')

async function fetchData() {
  error.value = ''
  try {
    data.value = await getPublicShare(route.params.token, password.value)
    needPassword.value = false
  } catch (e) {
    if (e.message === '需要密码') needPassword.value = true
    error.value = e.message
  }
}
onMounted(fetchData)

const dateText = (m) => (m.moment_date || m.created_at.slice(0, 10))
</script>

<template>
  <div class="fade-up">
    <header class="py-6 text-center">
      <div class="text-3xl">🏠</div>
      <h1 class="serif mt-2 text-2xl font-bold tracking-[0.3em]">共鸣小屋</h1>
      <p class="mt-1 text-sm text-white/55">来自一对恋人的私密时光 · 只读分享</p>
    </header>

    <!-- 密码门 -->
    <div v-if="needPassword" class="glass mx-auto max-w-sm p-6 text-center">
      <p class="text-sm text-white/60">这个分享需要密码</p>
      <input v-model="password" type="password" class="input-dark mt-3" placeholder="输入访问密码"
        @keyup.enter="fetchData" />
      <button class="btn-primary mt-3 w-full" @click="fetchData">打开</button>
      <p v-if="error" class="mt-2 text-sm text-rose-300">{{ error }}</p>
    </div>

    <!-- 失效 -->
    <div v-else-if="error" class="glass mx-auto max-w-sm p-8 text-center text-white/55">
      <div class="text-3xl">🥀</div>
      <p class="mt-3">{{ error }}</p>
    </div>

    <div v-else-if="data" class="space-y-5">
      <div class="glass p-5 text-center">
        <div class="text-lg">
          <span class="font-semibold">{{ data.users[0]?.nickname }}</span>
          <span class="mx-2 text-white/40">×</span>
          <span class="font-semibold text-accent">{{ data.users[1]?.nickname }}</span>
        </div>
        <div class="mt-1 text-xs text-white/50">
          相识 {{ data.daysTogether }} 天 · 记录 {{ data.stats.moments }} 个瞬间 · {{ data.stats.entries }} 篇日记
        </div>
      </div>

      <section>
        <h2 class="mb-3 text-sm text-white/60">✨ 恋爱瞬间</h2>
        <div class="space-y-3">
          <article v-for="(m, i) in data.moments" :key="m.id" class="glass fade-up p-4"
            :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }">
            <div class="text-xs text-white/45">{{ m.author?.nickname }} · {{ dateText(m) }}
              <span v-if="m.location"> · 📍 {{ m.location }}</span>
            </div>
            <p class="mt-2 text-sm whitespace-pre-wrap">{{ m.content }}</p>
            <div v-if="m.photos?.length" class="mt-2 flex flex-wrap gap-2">
              <img v-for="u in m.photos" :key="u" :src="u" class="h-20 w-20 rounded-lg object-cover" loading="lazy" />
            </div>
          </article>
        </div>
      </section>

      <section v-if="data.entries.length">
        <h2 class="mb-3 text-sm text-white/60">🌌 公开日记</h2>
        <div class="space-y-3">
          <article v-for="(e, i) in data.entries" :key="e.id" class="glass fade-up p-4"
            :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }">
            <div class="text-xs text-white/45">{{ e.created_at.slice(0, 10) }} · 日记</div>
            <h3 class="serif mt-1 font-semibold">{{ e.title || '无题日记' }}</h3>
            <p v-for="c in e.contents" :key="c.id" class="mt-1.5 text-sm whitespace-pre-wrap text-white/75">{{ c.content }}</p>
          </article>
        </div>
      </section>

      <section v-if="data.anniversaries.length">
        <h2 class="mb-3 text-sm text-white/60">📅 纪念日</h2>
        <div class="glass divide-y divide-white/5">
          <div v-for="a in data.anniversaries" :key="a.id" class="flex items-center justify-between p-3 text-sm">
            <span>{{ a.title }}</span>
            <span class="text-white/45">{{ a.date }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
