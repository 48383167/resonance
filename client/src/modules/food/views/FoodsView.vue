<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listFoods } from '../food.api.js'
import { toast } from '../../../stores/toast'
import { FOOD_CATEGORIES, FOOD_STATUSES, CATEGORY_LABELS, STATUS_LABELS, STATUS_CLASSES } from '../food.constants.js'
import FoodRating from '../components/FoodRating.vue'

// 美食列表：状态 / 分类筛选 + 关键词搜索（店名 / 菜名 / 地点 / 笔记），数据量小走本地过滤
const router = useRouter()
const items = ref([])
const loading = ref(true)
const fStatus = ref('')
const fCategory = ref('')
const keyword = ref('')

const statusFilters = [{ value: '', label: '全部' }, ...FOOD_STATUSES]
const categoryFilters = [{ value: '', label: '全部' }, ...FOOD_CATEGORIES]

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return items.value.filter((f) => {
    if (fStatus.value && f.status !== fStatus.value) return false
    if (fCategory.value && f.category !== fCategory.value) return false
    if (!k) return true
    const hay = [f.name, f.note, f.location, ...(f.dishes || []).map((d) => d.name)].join(' ').toLowerCase()
    return hay.includes(k)
  })
})

const visitedCount = computed(() => items.value.filter((f) => f.status !== 'want').length)

async function load() {
  loading.value = true
  try {
    items.value = await listFoods()
  } catch (e) {
    toast(e.message)
  } finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="fade-up space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="serif text-xl">美食</h2>
        <p class="text-xs text-theme-tertiary">哪家的什么好吃，都记在这里</p>
      </div>
      <span v-if="items.length" class="text-xs text-theme-tertiary">共 {{ items.length }} 家 · 去过 {{ visitedCount }} 家</span>
    </div>

    <!-- 状态筛选 -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button v-for="s in statusFilters" :key="s.value"
        class="min-h-11 shrink-0 rounded-full px-3 text-sm transition-colors"
        :class="fStatus === s.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
        @click="fStatus = s.value">
        {{ s.label }}
      </button>
    </div>

    <!-- 分类筛选 -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button v-for="c in categoryFilters" :key="c.value"
        class="min-h-11 shrink-0 rounded-full px-3 text-sm transition-colors"
        :class="fCategory === c.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
        @click="fCategory = c.value">
        {{ c.label }}
      </button>
    </div>

    <div class="flex items-center gap-2">
      <input v-model="keyword" class="input-dark !min-h-11 flex-1 text-sm" maxlength="40"
        placeholder="搜店名、菜名、地点…" />
    </div>

    <div v-if="loading" class="py-10 text-center text-sm text-theme-tertiary">加载中…</div>

    <div v-else-if="filtered.length" class="space-y-3">
      <article v-for="f in filtered" :key="f.id"
        class="glass cursor-pointer p-4 transition-colors hover:bg-white/5"
        @click="router.push(`/foods/${f.id}`)">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-medium">{{ f.name }}</h3>
          <span class="rounded-full px-2 py-0.5 text-[11px]" :class="STATUS_CLASSES[f.status]">{{ STATUS_LABELS[f.status] }}</span>
          <span class="text-[11px] text-theme-tertiary">{{ CATEGORY_LABELS[f.category] }}</span>
        </div>

        <FoodRating v-if="f.rating" :model-value="f.rating" readonly class="mt-1" />

        <p v-if="f.dishes?.length" class="mt-1.5 flex flex-wrap gap-1.5">
          <span v-for="d in f.dishes.slice(0, 3)" :key="d.id"
            class="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-theme-secondary">
            {{ d.name }}<template v-if="d.rating"> · {{ d.rating }}★</template>
          </span>
          <span v-if="f.dishes.length > 3" class="self-center text-[11px] text-theme-tertiary">+{{ f.dishes.length - 3 }}</span>
        </p>

        <p class="mt-1.5 text-[11px] text-theme-tertiary">
          <template v-if="f.location">📍 {{ f.location }}</template>
          <template v-if="f.avg_price != null"> · 人均 ¥{{ f.avg_price }}</template>
          <template v-if="f.hours"> · {{ f.hours }}</template>
        </p>
      </article>
    </div>

    <div v-else class="glass p-8 text-center text-sm text-theme-tertiary">
      {{ items.length ? '没有符合条件的美食，换个筛选试试。' : '还没有记录，去过或想去的店都记下来吧。' }}
    </div>

    <button class="btn-primary w-full" @click="router.push('/foods/new')">＋ 记一家店</button>
  </div>
</template>
