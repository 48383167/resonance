<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAlbum, albumPhotos, addPhoto, removePhoto as removePhotoApi, setCover as setCoverApi, updatePhotoCaption, removeAlbum as removeAlbumApi } from '../album.api.js'
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
</script>

<template>
  <div v-if="album" class="fade-up space-y-5">
    <div class="flex items-center justify-between">
      <button class="btn-ghost text-sm" @click="router.push('/albums')">← 相册列表</button>
      <button class="text-xs text-rose-300/70 hover:text-rose-300" @click="removeAlbum">删除相册</button>
    </div>

    <!-- 相册信息 -->
    <div class="glass p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-white/5 text-3xl">
            <img v-if="displayCover" :src="displayCover" class="h-full w-full object-cover" />
            <span v-else>📷</span>
          </div>
          <div>
            <h2 class="serif text-2xl font-bold">{{ album.name }}</h2>
            <p v-if="album.description" class="mt-1 text-sm text-white/55">{{ album.description }}</p>
            <div class="mt-1 text-xs text-white/40">{{ total }} 张照片 · 创建于 {{ new Date(album.created_at).toLocaleDateString('zh-CN') }}</div>
          </div>
        </div>
        <button class="btn-ghost text-sm" @click="router.push(`/albums/${album.id}/edit`)">✎ 编辑信息</button>
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
    <div v-if="photos.length" class="grid grid-cols-2 gap-4 md:grid-cols-3">
      <figure v-for="(p, pi) in photos" :key="p.id" class="glass overflow-hidden">
        <div class="relative h-44 cursor-zoom-in overflow-hidden" @click="openLightbox(photos.filter((x) => mediaTypeOf(x.url) === 'image').map((x) => x.url), pi)">
          <img v-if="mediaTypeOf(p.url) === 'image'" :src="p.url" class="h-full w-full object-cover" loading="lazy" />
          <video v-else-if="mediaTypeOf(p.url) === 'video'" :src="p.url" class="h-full w-full object-cover" controls />
          <div v-else class="flex h-full w-full items-center justify-center bg-white/5 text-3xl">📄</div>
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
            <div class="mt-2 flex items-center justify-between text-[11px]">
              <button class="text-white/45 hover:text-white" @click="openStory(p)">
                {{ p.caption ? '编辑故事' : '＋ 写故事' }}
              </button>
              <span class="flex gap-2.5">
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
