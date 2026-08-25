<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import EntryCard from '../components/EntryCard.vue'

// 日记列表：全部日记的专属列表页
const router = useRouter()
const entries = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    entries.value = await api.get('/api/entries')
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function togglePublic(entry) {
  await api.patch(`/api/entries/${entry.id}/visibility`, { isPublic: !entry.is_public })
  await load()
}
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="serif text-xl">日记</h2>
        <p class="text-xs text-white/45">共 {{ entries.length }} 篇</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost" @click="router.push('/diary')">🗓️ 日历视图</button>
        <button class="btn-primary" @click="router.push('/write/solo')">✎ 写日记</button>
      </div>
    </div>

    <div v-if="loading" class="py-10 text-center text-white/40">加载中…</div>
    <div v-else-if="!entries.length" class="glass p-10 text-center text-white/50">
      <div class="text-3xl">📔</div>
      <p class="mt-2">还没有日记，写下第一篇吧</p>
      <button class="btn-primary mt-4" @click="router.push('/write/solo')">写第一篇日记</button>
    </div>
    <div v-else class="grid gap-4">
      <EntryCard v-for="e in entries" :key="e.id" :entry="e" @open="(id) => router.push(`/entry/${id}`)"
        @toggle-public="togglePublic" />
    </div>
  </div>
</template>
