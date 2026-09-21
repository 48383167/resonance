<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFood, listFoodMoments, removeFood, setFoodStatus } from '../food.api.js'
import { listCareItems } from '../../care/care.api.js'
import { CATEGORY_LABELS, FOOD_STATUSES, STATUS_LABELS, STATUS_CLASSES } from '../food.constants.js'
import FoodRating from '../components/FoodRating.vue'
import CommentSection from '../../comment/components/CommentSection.vue'
import PinMenu from '../../../shared/components/PinMenu.vue'
import { socket } from '../../../socket'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import { openLightbox } from '../../../stores/lightbox'

// 美食详情：信息卡 + 招牌菜 + 忌口避雷 + 照片
const route = useRoute()
const router = useRouter()
const place = ref(null)
const loading = ref(true)
const busy = ref(false)
const careItems = ref([])
const moments = ref([])
const pinOpen = ref(false)

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/foods')
}

async function load() {
  try {
    place.value = await getFood(route.params.id)
  } catch (e) {
    toast(e.message)
    goBack()
  } finally {
    loading.value = false
  }
}

async function loadCare() {
  try { careItems.value = await listCareItems() } catch { careItems.value = [] }
}

async function loadMoments() {
  try { moments.value = await listFoodMoments(route.params.id) } catch { moments.value = [] }
}

// 忌口避雷：按名称双向包含匹配（仅按名字提示，以实际配料为准）
const watchlist = computed(() => careItems.value.filter((c) => c.category === 'diet' || c.category === 'allergy'))
const avoidHits = computed(() => {
  if (!place.value) return []
  const texts = [place.value.name, ...(place.value.dishes || []).map((d) => d.name)]
    .map((t) => String(t || '').trim())
    .filter((t) => t.length >= 2)
  const hits = []
  for (const care of watchlist.value) {
    const key = String(care.title || '').trim()
    if (key.length < 2) continue
    for (const text of texts) {
      if (text.includes(key) || key.includes(text)) {
        hits.push({ key, target: text, category: care.category, severity: care.severity })
      }
    }
  }
  return hits
})

async function changeStatus(status) {
  if (busy.value || place.value.status === status) return
  busy.value = true
  try {
    place.value = await setFoodStatus(place.value.id, status)
    toast(`已标记为「${STATUS_LABELS[status]}」`)
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}

async function remove() {
  const ok = await confirmDialog({ title: '删除这家店', message: `确定删除「${place.value.name}」吗？照片也会一并移除。` })
  if (!ok) return
  try {
    await removeFood(place.value.id)
    toast('已删除')
    goBack()
  } catch (e) {
    toast(e.message)
  }
}

function onFoodUpdated(payload) {
  if (payload?.id === route.params.id) place.value = payload
}
function onFoodDeleted(payload) {
  if (payload?.id === route.params.id) {
    toast('这家店已被删除')
    goBack()
  }
}

onMounted(() => {
  load()
  loadCare()
  loadMoments()
  socket.on('food:updated', onFoodUpdated)
  socket.on('food:deleted', onFoodDeleted)
})
onUnmounted(() => {
  socket.off('food:updated', onFoodUpdated)
  socket.off('food:deleted', onFoodDeleted)
})
</script>

<template>
  <div class="fade-up">
    <button class="btn-ghost mb-4 text-sm" @click="goBack">← 返回</button>

    <div v-if="loading" class="py-10 text-center text-sm text-theme-tertiary">加载中…</div>

    <template v-else-if="place">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="serif text-xl">{{ place.name }}</h1>
        <span class="rounded-full px-2 py-0.5 text-[11px]" :class="STATUS_CLASSES[place.status]">{{ STATUS_LABELS[place.status] }}</span>
        <span class="text-[11px] text-theme-tertiary">{{ CATEGORY_LABELS[place.category] }}</span>
        <button class="ml-auto min-h-11 min-w-11 touch-manipulation transition active:scale-90"
          :class="pinOpen || place.pin_scope ? 'text-accent' : 'text-theme-tertiary hover:text-accent'"
          title="设置置顶" @click="pinOpen = !pinOpen">📌</button>
      </div>
      <div v-if="pinOpen">
        <PinMenu target-type="food" :target-id="place.id" :scope="place.pin_scope || 'none'"
          @close="pinOpen = false" @change="load" />
      </div>
      <div class="mt-1.5 flex items-center gap-2">
        <FoodRating :model-value="place.rating" readonly />
        <span class="text-[11px] text-theme-tertiary">{{ place.author?.nickname || '我' }} 记于 {{ (place.created_at || '').slice(0, 10) }}</span>
      </div>

      <!-- 忌口避雷 -->
      <div v-if="avoidHits.length" class="danger-link mt-3 rounded-2xl border border-current p-4">
        <p class="text-sm font-medium">⚠️ 可能踩到忌口 / 过敏，点单前留意</p>
        <ul class="mt-1.5 space-y-0.5 text-xs">
          <li v-for="(hit, i) in avoidHits" :key="i">
            Ta 的{{ hit.category === 'allergy' ? '过敏源' : '忌口' }}「{{ hit.key }}」 ↔ 这里的「{{ hit.target }}」
          </li>
        </ul>
        <p class="mt-1.5 text-[10px] opacity-70">仅按名称匹配，具体以实际配料为准</p>
      </div>
      <div v-else-if="watchlist.length" class="surface-soft mt-3 rounded-2xl p-3">
        <p class="text-xs text-theme-secondary">✅ 按名称比对了 Ta 的忌口 / 过敏，暂未发现明显冲突</p>
        <p class="mt-1.5 flex flex-wrap gap-1.5">
          <span v-for="care in watchlist" :key="care.id"
            class="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-theme-tertiary">
            {{ care.category === 'allergy' ? '⚠️' : '🍽️' }} {{ care.title }}<template v-if="care.severity"> · {{ { mild: '轻度', moderate: '中度', severe: '重度' }[care.severity] }}</template>
          </span>
        </p>
      </div>

      <!-- 照片 -->
      <div v-if="place.photos?.length" class="mt-3 flex flex-wrap gap-2">
        <img v-for="(p, i) in place.photos" :key="p.id" :src="p.url"
          class="h-24 w-24 cursor-zoom-in rounded-xl object-cover" loading="lazy"
          @click="openLightbox(place.photos.map((x) => x.url), i)" />
      </div>

      <!-- 信息 -->
      <div class="glass mt-4 space-y-2 p-4 text-sm">
        <p v-if="place.hours" class="text-theme-secondary">🕐 {{ place.hours }}</p>
        <p v-if="place.location" class="text-theme-secondary">📍 {{ place.location }}</p>
        <p v-if="place.visited_at" class="text-theme-secondary">📅 {{ place.visited_at }}</p>
        <p v-if="place.note" class="whitespace-pre-wrap text-theme-secondary">{{ place.note }}</p>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button v-for="s in FOOD_STATUSES" :key="s.value" :disabled="busy"
            class="min-h-10 rounded-full px-3 text-xs touch-manipulation transition active:scale-95"
            :class="place.status === s.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
            @click="changeStatus(s.value)">
            {{ place.status === s.value ? '✓ ' : '' }}{{ s.label }}
          </button>
        </div>
      </div>

      <!-- 菜品 -->
      <div class="glass mt-4 p-4">
        <p class="mb-2 text-sm text-theme-secondary">🍜 菜品 · {{ (place.dishes || []).length }} 道</p>
        <ul v-if="place.dishes?.length" class="space-y-3">
          <li v-for="(dish, i) in place.dishes" :key="dish.id"
            class="surface-card rounded-2xl border border-theme p-3 shadow-sm">
            <div class="flex flex-wrap items-center gap-2">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-medium tabular-nums text-accent">{{ i + 1 }}</span>
              <span class="text-sm font-medium">{{ dish.name }}</span>
              <FoodRating :model-value="dish.rating" readonly />
              <span v-if="dish.price != null" class="ml-auto text-xs text-theme-tertiary">¥{{ dish.price }}</span>
            </div>
            <p v-if="dish.note" class="mt-1 pl-9 text-xs text-theme-tertiary">{{ dish.note }}</p>
            <div v-if="dish.photos?.length" class="mt-2 flex flex-wrap gap-2 pl-9">
              <img v-for="(p, i) in dish.photos" :key="p.id || i" :src="p.url"
                class="h-16 w-16 cursor-zoom-in rounded-lg object-cover" loading="lazy"
                @click="openLightbox(dish.photos.map((x) => x.url), i)" />
            </div>
          </li>
        </ul>
        <p v-else class="py-2 text-center text-xs text-theme-tertiary">还没有记录菜品</p>
      </div>

      <!-- 去过的约会：来自关联的恋爱瞬间 -->
      <div v-if="moments.length" class="glass mt-4 p-4">
        <p class="mb-2 text-sm text-theme-secondary">📸 去过的约会 · {{ moments.length }} 次</p>
        <div class="space-y-3">
          <article v-for="m in moments" :key="m.id" class="surface-soft rounded-xl p-3">
            <p class="text-[11px] text-theme-tertiary">
              {{ m.moment_date || (m.created_at || '').slice(0, 10) }} · {{ m.author?.nickname || 'Ta' }}<template v-if="m.location"> · 📍 {{ m.location }}</template>
            </p>
            <p class="mt-1 whitespace-pre-wrap text-sm text-theme-secondary">{{ m.content }}</p>
            <div v-if="m.photos?.length" class="mt-2 flex flex-wrap gap-2">
              <img v-for="(p, i) in m.photos" :key="p.id || i" :src="p.url"
                class="h-16 w-16 cursor-zoom-in rounded-lg object-cover" loading="lazy"
                @click="openLightbox(m.photos.map((x) => x.url), i)" />
            </div>
          </article>
        </div>
      </div>

      <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <button class="danger-link min-h-11 px-4 text-sm" @click="remove">删除</button>
        <button class="btn-primary w-full sm:w-auto" @click="router.push(`/foods/${place.id}/edit`)">编辑</button>
      </div>

      <CommentSection class="mt-4" target-type="food" :target-id="place.id" />
    </template>
  </div>
</template>
