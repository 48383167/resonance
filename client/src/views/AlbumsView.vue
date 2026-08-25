<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { toast } from '../stores/toast'
import { confirmDialog } from '../stores/confirm'

const router = useRouter()
const albums = ref([])

async function load() {
  albums.value = await api.get('/api/albums')
}
onMounted(load)

async function removeAlbum(a) {
  const ok = await confirmDialog({
    title: '删除相册',
    message: `即将删除相册「${a.name}」及其中的全部照片，此操作不可恢复。`,
    requireText: a.name,
  })
  if (!ok) return
  await api.delete(`/api/albums/${a.id}`)
  await load()
  toast('相册已删除')
}

// 展示封面：优先独立封面，否则用第一张照片代替展示
const coverOf = (a) => a.cover_url || a.firstPhotoUrl || ''
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">相册</h2>
        <p class="text-xs text-white/45">把照片和回忆收进册子</p>
      </div>
      <button class="btn-primary" @click="router.push('/albums/new')">+ 新建相册</button>
    </div>

    <div v-if="!albums.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">📷</div>
      <p class="mt-2">还没有相册，创建第一本吧</p>
      <button class="btn-primary mt-4" @click="router.push('/albums/new')">创建第一本相册</button>
    </div>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
      <div v-for="a in albums" :key="a.id" class="group relative">
        <div class="glass cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:bg-white/10"
          @click="router.push(`/albums/${a.id}`)">
          <div class="relative flex h-32 items-center justify-center overflow-hidden bg-white/5 text-4xl">
            <img v-if="coverOf(a)" :src="coverOf(a)" class="h-full w-full object-cover" loading="lazy" />
            <span v-else>📷</span>
            <!-- 未设置独立封面时的代替展示角标 -->
            <span v-if="!a.cover_url && a.firstPhotoUrl"
              class="absolute bottom-1.5 left-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/70">暂以首图代封面</span>
          </div>
          <div class="p-3">
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ a.name }}</span>
              <span class="text-xs text-white/45">{{ a.photoCount }} 张</span>
            </div>
            <p v-if="a.description" class="mt-1 line-clamp-1 text-xs text-white/45">{{ a.description }}</p>
          </div>
        </div>
        <button title="删除相册"
          class="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-rose-300/90 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
          @click="removeAlbum(a)">删除</button>
      </div>
    </div>
  </div>
</template>
