<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAlbum, albumPhotos, addPhoto, removePhoto as removePhotoApi, setCover as setCoverApi, updatePhotoCaption, updatePhotoObservatory, removeAlbum as removeAlbumApi } from '../album.api.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import { openLightbox } from '../../../stores/lightbox'
import { mediaTypeOf } from '../../../utils/media'
import ImageUpload from '../../../shared/components/ImageUpload.vue'

// 相册内页：编辑信息（独立页）/ 批量上传 / 每张照片写故事（内联）/ 分页无限加载
const route = useRoute()
const router = useRouter()
const album = ref(null)
const photos = ref([])
const total = ref(0)
const PAGE = 12
const loading = ref(false)
const sentinel = ref(null)

// 照片故事（内联编辑）
const storyPhotoId = ref(null)
const storyText = ref('')
const observatoryUpdating = ref(new Set())

const uploadUrls = ref([])

async function loadAlbum() {
  album.value = await getAlbum(route.params.id)
}

async function loadPhotos(reset = true) {
  if (loading.value) return
  loading.value = true
  try {
    const offset = reset ? 0 : photos.value.length
    const data = await albumPhotos(route.params.id, offset, PAGE)
    if (reset) photos.value = data.items
    else photos.value = [...photos.value, ...data.items]
    total.value = data.total
  } finally {
    loading.value = false
  }
}

// 无限加载
let observer = null
onMounted(async () => {
  await loadAlbum()
  await loadPhotos()
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && photos.value.length < total.value) loadPhotos(false)
  }, { rootMargin: '200px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
onUnmounted(() => observer?.disconnect())

async function addUploaded() {
  if (!uploadUrls.value.length) return
  const count = uploadUrls.value.length
  for (const u of uploadUrls.value) {
    if (!u?.id) continue
    await addPhoto(album.value.id, { fileId: u.id })
  }
  uploadUrls.value = []
  await loadPhotos(true)
  await loadAlbum()
  toast(`已加入 ${count} 个文件`)
}

async function removePhoto(p) {
  const ok = await confirmDialog({ title: '删除照片', message: '确定从相册中删除这张照片吗？' })
  if (!ok) return
  await removePhotoApi(album.value.id, p.id)
  photos.value = photos.value.filter((x) => x.id !== p.id)
  total.value -= 1
  await loadAlbum()
  toast('照片已删除')
}

async function setCover(p) {
  album.value = await setCoverApi(album.value.id, { fileId: p.file_id })
  toast('封面已更新')
}

function openStory(p) {
  storyPhotoId.value = p.id
  storyText.value = p.caption || ''
}

function cancelStory() {
  storyPhotoId.value = null
  storyText.value = ''
}

async function saveStory() {
  const p = photos.value.find((x) => x.id === storyPhotoId.value)
  if (!p) return
  const updated = await updatePhotoCaption(album.value.id, p.id, storyText.value)
  const idx = photos.value.findIndex((x) => x.id === updated.id)
  if (idx >= 0) photos.value[idx] = updated
  cancelStory()
  toast('故事已保存 ✍️')
}

function isInObservatory(photo) {
  return photo.show_in_observatory === 1 || photo.show_in_observatory === true
}

function isImagePhoto(photo) {
  return photo.type === 'image' || mediaTypeOf(photo.url) === 'image'
}

async function toggleObservatory(photo) {
  if (observatoryUpdating.value.has(photo.id) || !isImagePhoto(photo)) return
  observatoryUpdating.value = new Set(observatoryUpdating.value).add(photo.id)
  const nextValue = !isInObservatory(photo)
  try {
    const updated = await updatePhotoObservatory(album.value.id, photo.id, nextValue)
    Object.assign(photo, updated)
    const detailPhoto = album.value.photos?.find((item) => item.id === photo.id)
    if (detailPhoto) Object.assign(detailPhoto, updated)
    toast(nextValue ? '已加入观测台' : '已移出观测台')
  } finally {
    const next = new Set(observatoryUpdating.value)
    next.delete(photo.id)
    observatoryUpdating.value = next
  }
}

async function removeAlbum() {
  const ok = await confirmDialog({
    title: '删除相册',
    message: `即将删除相册「${album.value.name}」及其中的全部照片，此操作不可恢复。`,
    requireText: album.value.name,
  })
  if (!ok) return
  await removeAlbumApi(album.value.id)
  toast('相册已删除')
  router.push('/albums')
}

// 展示封面：优先独立封面，否则用第一张照片代替展示
const displayCover = computed(() => album.value.cover_url || photos.value[0]?.url || '')
const imagePhotos = computed(() => photos.value.filter(isImagePhoto))
const observatoryCount = computed(() => (album.value?.photos || photos.value).filter(isImagePhoto).filter(isInObservatory).length)

function openPhoto(photo) {
  const index = imagePhotos.value.findIndex((item) => item.id === photo.id)
  if (index >= 0) openLightbox(imagePhotos.value.map((item) => item.url), index)
}
</script>

<template>
  <div v-if="album" class="fade-up space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button class="btn-ghost text-sm" @click="router.push('/albums')">← 相册列表</button>
      <button class="text-xs text-rose-300/70 hover:text-rose-300" @click="removeAlbum">删除相册</button>
    </div>

    <!-- 相册信息 -->
     <div class="glass p-5">
       <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 items-start gap-3 sm:gap-4">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 text-3xl sm:h-20 sm:w-20">
            <img v-if="displayCover" :src="displayCover" class="h-full w-full object-cover" />
            <span v-else>📷</span>
          </div>
          <div class="min-w-0">
            <h2 class="serif break-words text-2xl font-bold">{{ album.name }}</h2>
            <p v-if="album.description" class="mt-1 break-words text-sm text-white/55">{{ album.description }}</p>
            <div class="mt-1 text-xs text-white/40">{{ total }} 张照片 · 创建于 {{ new Date(album.created_at).toLocaleDateString('zh-CN') }}</div>
          </div>
        </div>
         <button class="btn-ghost w-full text-sm sm:w-auto" @click="router.push(`/albums/${album.id}/edit`)">✎ 编辑信息</button>
       </div>
       <div class="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-xs">
         <span class="text-base text-accent" aria-hidden="true">◎</span>
         <span class="font-medium text-theme-primary">观测台展示</span>
         <span class="text-theme-secondary">点击照片右上角开关，选择要在观测台照片雨中出现的图片。</span>
         <span class="ml-auto rounded-full bg-accent-soft px-2 py-1 font-medium text-accent">已选 {{ observatoryCount }} 张</span>
       </div>
     </div>

    <!-- 批量上传 -->
    <div class="glass p-5">
      <h3 class="mb-3 text-sm text-white/70">批量上传照片 / 视频</h3>
      <ImageUpload v-model="uploadUrls" accept="all" />
      <button v-if="uploadUrls.length" class="btn-primary mt-3" @click="addUploaded">
        将 {{ uploadUrls.length }} 个文件加入相册
      </button>
    </div>

    <!-- 照片网格 -->
    <div v-if="photos.length" class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
      <figure v-for="p in photos" :key="p.id" class="glass overflow-hidden">
        <div class="relative aspect-square overflow-hidden" :class="isImagePhoto(p) ? 'cursor-zoom-in' : ''" @click="isImagePhoto(p) && openPhoto(p)">
          <img v-if="isImagePhoto(p)" :src="p.url" class="h-full w-full object-cover" loading="lazy" />
          <video v-else-if="p.type === 'video' || mediaTypeOf(p.url) === 'video'" :src="p.url" class="h-full w-full object-cover" controls @click.stop />
          <div v-else class="flex h-full w-full items-center justify-center bg-white/5 text-3xl">📄</div>
          <button v-if="isImagePhoto(p)" type="button"
            class="absolute right-2 top-2 z-10 flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-md transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            :class="isInObservatory(p)
              ? 'border-accent bg-accent text-[var(--accent-contrast)]'
              : 'border-white/35 bg-black/60 text-white'"
            :disabled="observatoryUpdating.has(p.id)" :aria-pressed="isInObservatory(p)"
            :aria-label="isInObservatory(p) ? '移出观测台' : '加入观测台'" @click.stop="toggleObservatory(p)">
            <span aria-hidden="true">{{ isInObservatory(p) ? '✓' : '◎' }}</span>
            {{ isInObservatory(p) ? '已在观测台' : '展示到观测台' }}
          </button>
        </div>
        <figcaption class="p-3">
          <!-- 内联编辑故事 -->
          <div v-if="storyPhotoId === p.id" class="space-y-2">
            <textarea v-model="storyText" class="input-dark resize-none !px-3 !py-2 text-xs" rows="4"
              placeholder="这张照片背后的故事…" />
            <div class="flex justify-end gap-3 text-xs">
              <button class="text-white/45 hover:text-white" @click="cancelStory">取消</button>
              <button class="text-accent-2 hover-text-accent-2" @click="saveStory">保存故事</button>
            </div>
          </div>
          <!-- 普通展示 -->
          <template v-else>
            <p v-if="p.caption" class="line-clamp-3 text-xs leading-relaxed text-white/70">{{ p.caption }}</p>
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <button class="text-white/45 hover:text-white" @click="openStory(p)">
                {{ p.caption ? '编辑故事' : '＋ 写故事' }}
              </button>
              <span class="flex flex-wrap justify-end gap-x-2.5 gap-y-1">
                <button class="text-white/45 hover:text-white" @click="setCover(p)">
                  {{ album.cover_file_id === p.file_id ? '✓ 封面' : '设为封面' }}
                </button>
                <button class="text-rose-300/70 hover:text-rose-300" @click="removePhoto(p)">删除</button>
              </span>
            </div>
          </template>
        </figcaption>
      </figure>
    </div>
    <div v-else class="glass p-10 text-center text-white/50">
      <div class="text-3xl">📷</div>
      <p class="mt-2">相册还是空的，上传第一张照片吧</p>
    </div>

    <!-- 加载哨兵 -->
    <div ref="sentinel" class="py-2 text-center text-xs text-white/35">
      {{ photos.length < total ? '向下滚动加载更多…' : `共 ${total} 张` }}
    </div>
  </div>
</template>
