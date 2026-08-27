<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPublicShare } from '../../../modules/observatory/observatory.api.js'
import { openLightbox } from '../../../stores/lightbox'
import { mediaTypeOf } from '../../../utils/media'

const route = useRoute()
const router = useRouter()
const data = ref(null)
const error = ref('')
const loading = ref(true)
const needPassword = ref(false)
const password = ref('')

async function fetchData() {
  error.value = ''
  loading.value = true
  try {
    data.value = await getPublicShare(route.params.token, password.value)
    needPassword.value = false
  } catch (e) {
    if (e.message === '需要密码') needPassword.value = true
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

const moments = computed(() => data.value?.moments || [])
const entries = computed(() => data.value?.entries || [])
const anniversaries = computed(() => data.value?.anniversaries || [])
const hasContent = computed(() => moments.value.length || entries.value.length || anniversaries.value.length)

function dateText(item, key = 'created_at') {
  const value = item.moment_date || item[key] || item.date
  return value ? String(value).slice(0, 10) : '某个温柔的日子'
}

function imageItems(moment) {
  return (moment.photos || []).filter((photo) => {
    const url = typeof photo === 'string' ? photo : photo?.url
    return url && ((typeof photo !== 'string' && photo.type === 'image') || mediaTypeOf(url) === 'image')
  })
}

function imageUrl(photo) {
  return typeof photo === 'string' ? photo : photo.url
}

function showPhoto(moment, photo) {
  const images = imageItems(moment)
  const index = images.indexOf(photo)
  if (index >= 0) openLightbox(images.map(imageUrl), index)
}

function entryText(entry) {
  return (entry.contents || []).map((content) => content.content).filter(Boolean)
}
</script>

<template>
  <div class="min-h-screen bg-[#f4e8dc] px-4 py-6 text-[#5d4843] sm:px-6 sm:py-10">
    <div class="mx-auto max-w-5xl">
      <header class="relative overflow-hidden rounded-[2rem] border border-[#d9b9a3]/60 bg-[#fffaf1] px-6 py-10 text-center shadow-[0_16px_45px_rgba(132,91,70,.13)] sm:px-12">
        <span class="absolute left-8 top-5 rotate-[-8deg] rounded-sm bg-[#e8b8ae] px-3 py-1 text-[10px] tracking-[.24em] text-[#815b58] shadow-sm">OUR STORY</span>
        <span class="absolute right-8 top-7 rotate-[7deg] rounded-sm bg-[#f2d487] px-3 py-1 text-[10px] tracking-[.18em] text-[#806841] shadow-sm">KEEP THIS</span>
        <div class="relative">
          <p class="text-xs tracking-[.32em] text-[#b58378]">A LITTLE LOVE ARCHIVE</p>
          <h1 class="serif mt-3 text-4xl font-semibold tracking-wide text-[#664b46] sm:text-6xl">我们的恋爱剪贴簿</h1>
          <div v-if="data" class="mt-5 flex flex-wrap items-center justify-center gap-3 text-lg">
            <span class="rounded-full bg-[#f7e1d4] px-4 py-2 font-semibold">{{ data.users?.[0]?.nickname || '我们' }}</span>
            <span class="text-2xl text-[#d28e87]">♡</span>
            <span class="rounded-full bg-[#f7e1d4] px-4 py-2 font-semibold">{{ data.users?.[1]?.nickname || 'Ta' }}</span>
          </div>
          <p v-if="data" class="mt-4 text-sm text-[#9b7870]">一起走过 {{ data.daysTogether || 0 }} 天 · 把平凡日子收藏成闪光</p>
        </div>
      </header>

      <div v-if="loading" class="py-20 text-center text-[#a78176]">正在翻开这本小小的剪贴簿…</div>

      <section v-else-if="needPassword" class="mx-auto mt-8 max-w-sm rounded-[1.5rem] bg-[#fffaf1] p-7 text-center shadow-[0_12px_30px_rgba(132,91,70,.12)]">
        <div class="text-4xl">🔐</div>
        <h2 class="serif mt-3 text-xl">这本剪贴簿有一把小锁</h2>
        <p class="mt-2 text-sm text-[#9b7870]">输入密码，打开属于他们的故事</p>
        <input v-model="password" type="password" class="mt-5 w-full rounded-xl border border-[#e3cabc] bg-white/70 px-4 py-3 outline-none focus:border-[#cf9189]" placeholder="输入访问密码" @keyup.enter="fetchData" />
        <button class="mt-3 w-full rounded-xl bg-[#c9827e] px-4 py-3 font-medium text-white shadow-sm transition hover:-translate-y-0.5" @click="fetchData">打开剪贴簿</button>
        <p v-if="error" class="mt-3 text-sm text-[#bd6f6f]">{{ error }}</p>
      </section>

      <section v-else-if="error" class="mx-auto mt-8 max-w-sm rounded-[1.5rem] bg-[#fffaf1] p-9 text-center text-[#9b7870] shadow-[0_12px_30px_rgba(132,91,70,.12)]">
        <div class="text-4xl">🥀</div><p class="mt-4">{{ error }}</p>
        <button class="mt-6 rounded-full border border-[#d9b9a3] px-5 py-2 text-sm" @click="router.push('/login')">进入共鸣</button>
      </section>

      <div v-else-if="data" class="mt-8 space-y-12">
        <div v-if="!hasContent" class="rounded-[1.5rem] bg-[#fffaf1] px-6 py-14 text-center text-[#9b7870] shadow-[0_12px_30px_rgba(132,91,70,.1)]">
          <div class="text-4xl">🌷</div><p class="serif mt-4 text-xl">故事正在慢慢收集</p><p class="mt-2 text-sm">这里还没有可以展示的内容，先留下一点甜吧。</p>
        </div>

        <section v-if="moments.length">
          <div class="mb-5 flex items-end justify-between"><div><p class="text-xs tracking-[.24em] text-[#bd8880]">MOMENTS</p><h2 class="serif mt-1 text-3xl">恋爱瞬间</h2></div><span class="text-sm text-[#ad8378]">{{ moments.length }} 个收藏</span></div>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article v-for="(moment, index) in moments" :key="moment.id" class="relative overflow-hidden rounded-lg bg-[#fffdf7] p-3 shadow-[0_8px_20px_rgba(132,91,70,.14)] transition hover:-translate-y-1" :class="index % 3 === 1 ? 'rotate-[1deg]' : index % 3 === 2 ? 'rotate-[-1deg]' : 'rotate-[-.5deg]'">
              <span class="absolute -top-2 left-1/2 z-10 h-5 w-16 -translate-x-1/2 rotate-[-3deg] bg-[#e8b8ae]/80 shadow-sm" />
              <div v-if="imageItems(moment).length" class="grid gap-2" :class="imageItems(moment).length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
                <button v-for="photo in imageItems(moment)" :key="imageUrl(photo)" class="aspect-[4/3] min-w-0 overflow-hidden bg-[#ead8ca]" @click="showPhoto(moment, photo)"><img :src="imageUrl(photo)" class="h-full w-full object-cover transition duration-500 hover:scale-105" loading="lazy" alt="恋爱瞬间" /></button>
              </div>
              <div class="px-1 pb-1 pt-3"><p class="text-[11px] text-[#b48a7f]">{{ dateText(moment) }}<span v-if="moment.location"> · 📍 {{ moment.location }}</span></p><p class="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{{ moment.content || '把这一天轻轻收好。' }}</p><p v-if="moment.author?.nickname" class="mt-3 text-xs text-[#c09188]">— {{ moment.author.nickname }}</p></div>
            </article>
          </div>
        </section>

        <section v-if="entries.length">
          <div class="mb-5"><p class="text-xs tracking-[.24em] text-[#bd8880]">DEAR DIARY</p><h2 class="serif mt-1 text-3xl">公开日记</h2></div>
          <div class="grid gap-5 md:grid-cols-2">
            <article v-for="(entry, index) in entries" :key="entry.id" class="rounded-2xl border border-[#ead4c5] bg-[#f9edc9] p-5 shadow-[3px_5px_0_rgba(205,157,117,.16)]" :class="index % 2 ? 'rotate-[.5deg]' : 'rotate-[-.5deg]'">
              <p class="text-xs text-[#ae8770]">{{ dateText(entry) }} · 日记</p><h3 class="serif mt-2 break-words text-xl">{{ entry.title || '无题日记' }}</h3><p v-for="(text, i) in entryText(entry)" :key="i" class="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#765c51]">{{ text }}</p>
            </article>
          </div>
        </section>

        <section v-if="anniversaries.length">
          <div class="mb-5"><p class="text-xs tracking-[.24em] text-[#bd8880]">IMPORTANT DAYS</p><h2 class="serif mt-1 text-3xl">纪念日</h2></div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><article v-for="anniversary in anniversaries" :key="anniversary.id" class="rounded-2xl border border-[#e7c0b6] bg-[#fff8f3] p-5 shadow-[0_8px_18px_rgba(132,91,70,.1)]"><div class="flex items-start justify-between gap-3"><span class="text-2xl">🌷</span><time class="rounded-full bg-[#f6dfd8] px-3 py-1 text-xs text-[#a87570]">{{ anniversary.date }}</time></div><h3 class="serif mt-4 break-words text-lg">{{ anniversary.title }}</h3><p v-if="anniversary.description" class="mt-2 break-words text-sm leading-6 text-[#98776f]">{{ anniversary.description }}</p></article></div>
        </section>

        <footer class="pb-6 text-center"><p class="text-sm text-[#ad8378]">愿每一个普通日子，都被好好记住。</p><button class="mt-4 rounded-full border border-[#d9b9a3] bg-[#fffaf1]/70 px-5 py-2 text-sm text-[#8e6963] transition hover:bg-white" @click="router.push('/login')">进入共鸣</button></footer>
      </div>
    </div>
  </div>
</template>
