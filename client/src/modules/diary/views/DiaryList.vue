<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listDiary, setVisibility } from '../diary.api.js'
import EntryCard from '../components/EntryCard.vue'

// 日记列表：全部日记的专属列表页
const router = useRouter()
const entries = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    entries.value = await listDiary()
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function togglePublic(entry) {
  await setVisibility(entry.id, !entry.is_public)
  await load()
}
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="serif text-xl">日记</h2>
        <p class="text-xs text-white/45">共 {{ entries.length }} 篇</p>
      </div>
      <div class="flex w-full flex-wrap gap-2 sm:w-auto">
        <button class="btn-ghost flex-1 whitespace-nowrap sm:flex-none" @click="router.push('/diary')">🗓️ 日历视图</button>
        <button class="btn-primary flex-1 whitespace-nowrap sm:flex-none" @click="router.push('/write/solo')">✎ 写日记</button>
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
