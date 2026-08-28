<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toBlob } from 'html-to-image'
import { getPublicShare } from '../../../modules/observatory/observatory.api.js'
import { openLightbox } from '../../../stores/lightbox'
import { toast } from '../../../stores/toast'
import { mediaTypeOf } from '../../../utils/media'

const route = useRoute()
const data = ref(null)
const error = ref('')
const loading = ref(true)
const needPassword = ref(false)
const password = ref('')
const scrapbookRef = ref(null)
const exporting = ref(false)

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

function decodeImage(image) {
  return typeof image.decode === 'function' ? image.decode() : Promise.resolve()
}

function waitForImage(image) {
  if (image.complete) {
    return image.naturalWidth > 0 ? decodeImage(image) : Promise.reject(new Error('image-load-failed'))
  }

  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => decodeImage(image).then(resolve).catch(reject), { once: true })
    image.addEventListener('error', () => reject(new Error('image-load-failed')), { once: true })
  })
}

async function saveScrapbook() {
  if (exporting.value || !scrapbookRef.value) return

  exporting.value = true
  try {
    const images = [...scrapbookRef.value.querySelectorAll('img')]
    images.forEach((image) => {
      image.loading = 'eager'
      const source = image.currentSrc || image.src
      if (source && new URL(source, window.location.href).origin !== window.location.origin) {
        image.crossOrigin = 'anonymous'
        image.src = source
      }
    })
    await Promise.all(images.map(waitForImage))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const scrapbook = scrapbookRef.value
    const bounds = scrapbook.getBoundingClientRect()
    const blob = await toBlob(scrapbook, {
      backgroundColor: '#f4e8dc',
      cacheBust: true,
      pixelRatio: 2,
      width: Math.ceil(bounds.width),
      height: Math.ceil(scrapbook.scrollHeight),
      filter: (element) => !(element instanceof HTMLElement && element.hasAttribute('data-export-ignore')),
    })

    if (!blob || !blob.size) throw new Error('empty-canvas')

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `resonance-scrapbook-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('剪贴簿长图已保存')
  } catch (e) {
    if (e.message === 'image-load-failed') {
      toast('图片加载失败（可能是跨域图片），无法生成长图，请检查图片后重试', 'error')
    } else {
      toast('内容过长或图片未加载完成，请稍后重试', 'error')
    }
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="mt-3">
    <div v-if="data" class="flex justify-end px-3 pb-2 sm:px-2">
      <button data-export-ignore type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white/65 shadow-sm backdrop-blur transition hover:border-white/25 hover:bg-black/30 hover:text-white disabled:cursor-wait disabled:opacity-60"
        :disabled="exporting" @click="saveScrapbook">
        <span aria-hidden="true">↓</span>
        {{ exporting ? '正在生成长图…' : '保存剪贴簿长图' }}
      </button>
    </div>

    <div ref="scrapbookRef" class="share-scrapbook min-h-screen bg-[#f4e8dc] px-3 pb-6 pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#5d4843] sm:px-6 sm:py-10">
    <div class="mx-auto max-w-5xl">
      <header class="relative overflow-hidden rounded-[0.9rem] border border-[#d9b9a3]/80 bg-[#fffaf1] px-4 pb-6 pt-16 text-center shadow-[0_10px_24px_rgba(132,91,70,.16)] sm:rounded-[1.25rem] sm:px-12 sm:py-10">
        <span class="absolute left-5 top-4 rotate-[-8deg] rounded-sm bg-[#e8b8ae] px-2.5 py-1 text-[9px] tracking-[.2em] text-[#815b58] shadow-sm sm:left-8 sm:top-5 sm:px-3 sm:text-[10px] sm:tracking-[.24em]">OUR STORY</span>
        <span class="absolute right-5 top-5 rotate-[7deg] rounded-sm bg-[#f2d487] px-2.5 py-1 text-[9px] tracking-[.15em] text-[#806841] shadow-sm sm:right-8 sm:top-7 sm:px-3 sm:text-[10px] sm:tracking-[.18em]">KEEP THIS</span>
        <div class="relative">
          <p class="text-[11px] tracking-[.22em] text-[#b58378] sm:text-xs sm:tracking-[.32em]">A LITTLE LOVE ARCHIVE</p>
          <h1 class="serif mx-auto mt-2 max-w-full text-[clamp(1.75rem,8.5vw,2.35rem)] font-semibold leading-[1.15] tracking-[.02em] text-[#664b46] sm:mt-3 sm:text-6xl sm:tracking-wide">我们的恋爱剪贴簿</h1>
          <div v-if="data" class="mx-auto mt-4 grid max-w-[22rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 text-base sm:mt-5 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-3 sm:text-lg">
            <span class="min-w-0 truncate rounded-full bg-[#f7e1d4] px-2.5 py-1.5 font-semibold sm:px-4 sm:py-2">{{ data.users?.[0]?.nickname || '我们' }}</span>
            <span class="text-xl text-[#d28e87] sm:text-2xl">♡</span>
            <span class="min-w-0 truncate rounded-full bg-[#f7e1d4] px-2.5 py-1.5 font-semibold sm:px-4 sm:py-2">{{ data.users?.[1]?.nickname || 'Ta' }}</span>
           </div>
           <p v-if="data" class="mt-3 text-xs leading-5 text-[#9b7870] sm:mt-4 sm:text-sm">一起走过 {{ data.daysTogether || 0 }} 天 · 把平凡日子收藏成闪光</p>
         </div>
       </header>

      <div v-if="loading" class="py-14 text-center text-[#a78176] sm:py-20">正在翻开这本小小的剪贴簿…</div>

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
      </section>

      <div v-else-if="data" class="mt-5 space-y-8 sm:mt-8 sm:space-y-12">
        <div v-if="!hasContent" class="rounded-lg border border-[#e2cabb] bg-[#fffaf1] px-6 py-14 text-center text-[#9b7870] shadow-[0_8px_20px_rgba(132,91,70,.12)]">
          <div class="text-4xl">🌷</div><p class="serif mt-4 text-xl">故事正在慢慢收集</p><p class="mt-2 text-sm">这里还没有可以展示的内容，先留下一点甜吧。</p>
        </div>

        <section v-if="moments.length">
          <div class="mb-4 flex items-end justify-between sm:mb-5"><div><p class="text-xs tracking-[.24em] text-[#bd8880]">MOMENTS</p><h2 class="serif mt-1 text-3xl">恋爱瞬间</h2></div><span class="text-sm text-[#ad8378]">{{ moments.length }} 个收藏</span></div>
          <div class="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            <article v-for="(moment, index) in moments" :key="moment.id" class="relative overflow-hidden rounded-md border border-[#e4cec0] bg-[#fffdf7] p-2.5 shadow-[0_7px_16px_rgba(132,91,70,.16)] transition hover:-translate-y-1 sm:p-3" :class="index % 3 === 1 ? 'rotate-[1deg]' : index % 3 === 2 ? 'rotate-[-1deg]' : 'rotate-[-.5deg]'">
              <span class="absolute -top-2 left-1/2 z-10 h-5 w-16 -translate-x-1/2 rotate-[-3deg] bg-[#e8b8ae]/80 shadow-sm" />
              <div v-if="imageItems(moment).length" class="grid gap-2" :class="imageItems(moment).length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
                <button v-for="photo in imageItems(moment)" :key="imageUrl(photo)" class="aspect-[5/3] min-w-0 overflow-hidden bg-[#ead8ca] sm:aspect-[4/3]" @click="showPhoto(moment, photo)"><img :src="imageUrl(photo)" class="h-full w-full object-cover transition duration-500 hover:scale-105" loading="lazy" alt="恋爱瞬间" /></button>
              </div>
              <div class="px-1 pb-1 pt-3"><p class="text-[11px] text-[#b48a7f]">{{ dateText(moment) }}<span v-if="moment.location"> · 📍 {{ moment.location }}</span></p><p class="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{{ moment.content || '把这一天轻轻收好。' }}</p><p v-if="moment.author?.nickname" class="mt-3 text-xs text-[#c09188]">— {{ moment.author.nickname }}</p></div>
            </article>
          </div>
        </section>

        <section v-if="entries.length">
          <div class="mb-5"><p class="text-xs tracking-[.24em] text-[#bd8880]">DEAR DIARY</p><h2 class="serif mt-1 text-3xl">公开日记</h2></div>
          <div class="grid gap-5 md:grid-cols-2">
              <article v-for="(entry, index) in entries" :key="entry.id" class="rounded-lg border border-[#ead4c5] bg-[#f9edc9] p-5 shadow-[3px_5px_0_rgba(205,157,117,.18)]" :class="index % 2 ? 'rotate-[.5deg]' : 'rotate-[-.5deg]'">
              <p class="text-xs text-[#ae8770]">{{ dateText(entry) }} · 日记</p><h3 class="serif mt-2 break-words text-xl">{{ entry.title || '无题日记' }}</h3><p v-for="(text, i) in entryText(entry)" :key="i" class="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#765c51]">{{ text }}</p>
            </article>
          </div>
        </section>

        <section v-if="anniversaries.length">
          <div class="mb-5"><p class="text-xs tracking-[.24em] text-[#bd8880]">IMPORTANT DAYS</p><h2 class="serif mt-1 text-3xl">纪念日</h2></div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><article v-for="anniversary in anniversaries" :key="anniversary.id" class="rounded-lg border border-[#e7c0b6] bg-[#fff8f3] p-5 shadow-[0_7px_16px_rgba(132,91,70,.12)]"><div class="flex items-start justify-between gap-3"><span class="text-2xl">🌷</span><time class="rounded-full bg-[#f6dfd8] px-3 py-1 text-xs text-[#a87570]">{{ anniversary.date }}</time></div><h3 class="serif mt-4 break-words text-lg">{{ anniversary.title }}</h3><p v-if="anniversary.description" class="mt-2 break-words text-sm leading-6 text-[#98776f]">{{ anniversary.description }}</p></article></div>
        </section>

        <footer class="pb-6 text-center"><p class="text-sm text-[#ad8378]">愿每一个普通日子，都被好好记住。</p></footer>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.share-scrapbook {
  border: 1px solid rgb(217 185 163 / 0.58);
  border-radius: 14px;
  box-shadow: 0 14px 34px rgb(55 35 29 / 0.12);
  overflow: hidden;
}

@media (min-width: 640px) {
  .share-scrapbook { border-radius: 20px; }
}
</style>
