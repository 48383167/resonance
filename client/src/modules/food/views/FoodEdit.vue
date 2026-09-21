<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createFood, getFood, updateFood, removeFood, parseFoodDraft } from '../food.api.js'
import { MAX_PHOTOS, FOOD_CATEGORIES, FOOD_STATUSES } from '../food.constants.js'
import { generateIdempotencyKey } from '../../../utils/idempotency.js'
import { loadFormDraft, saveFormDraft, clearFormDraft } from '../../../utils/draft.js'
import { toast } from '../../../stores/toast'
import { confirmDialog } from '../../../stores/confirm'
import AppSelect from '../../../shared/components/AppSelect.vue'
import AppDatePicker from '../../../shared/components/AppDatePicker.vue'
import ImageUpload from '../../../shared/components/ImageUpload.vue'
import FoodRating from '../components/FoodRating.vue'
import FoodDishRows from '../components/FoodDishRows.vue'

// 新增 / 编辑美食：店名、分类、状态、评分、营业信息、照片、菜品（含菜品图片）
const route = useRoute()
const router = useRouter()
const editingId = route.params.id || null
const busy = ref(false)
let createKey = null

const DRAFT_KEY = 'food-new'

function initialForm() {
  return {
    name: '',
    category: 'snack',
    status: 'want',
    rating: null,
    location: '',
    hours: '',
    note: '',
    visitedAt: '',
    dishes: [],
    photos: [],
  }
}

const form = ref(initialForm())
const draftRestored = ref(false)
const dishRows = ref(null)

if (!editingId) {
  const draft = loadFormDraft(DRAFT_KEY)
  if (draft) {
    form.value = { ...initialForm(), ...draft }
    draftRestored.value = true
  }
}
watch(form, (value) => {
  if (editingId) return
  saveFormDraft(DRAFT_KEY, value)
}, { deep: true })

function discardDraft() {
  form.value = initialForm()
  nextTick(() => clearFormDraft(DRAFT_KEY))
  draftRestored.value = false
  toast('草稿已清空')
}

// —— AI 粘贴成店：把一段笔记变成表单草稿（仅新建；只预填、不保存）——
const aiOpen = ref(false)
const aiText = ref('')
const aiBusy = ref(false)

function applyDraft(draft) {
  const f = form.value
  if (draft.name && !f.name.trim()) f.name = draft.name
  if (draft.category && draft.category !== 'other' && f.category === 'snack') f.category = draft.category
  if (draft.rating && !f.rating) f.rating = draft.rating
  if (draft.hours && !f.hours.trim()) f.hours = draft.hours
  if (draft.location && !f.location.trim()) f.location = draft.location
  if (draft.note && !f.note.trim()) f.note = draft.note
  if (draft.dishes?.length) {
    let seq = 0
    const existing = new Set(f.dishes.map((d) => String(d.name || '').trim().toLowerCase()))
    for (const dish of draft.dishes) {
      const key = String(dish.name || '').trim().toLowerCase()
      if (!key || existing.has(key)) continue
      existing.add(key)
      f.dishes.push({ _key: `ai_${Date.now().toString(36)}_${++seq}`, name: dish.name, rating: dish.rating, note: dish.note, price: dish.price, photos: [] })
    }
  }
}

async function generateDraft() {
  const text = aiText.value.trim()
  if (!text || aiBusy.value) return
  aiBusy.value = true
  try {
    const { draft } = await parseFoodDraft(text)
    applyDraft(draft)
    toast('已填入表单，请核对后保存')
  } catch (e) {
    toast(e.message)
  } finally {
    aiBusy.value = false
  }
}

const canGoBack = Boolean(history.state?.back)
function goBack() {
  if (canGoBack) router.back()
  else router.push('/foods')
}

onMounted(async () => {
  if (!editingId) {
    if (draftRestored.value) toast('已恢复上次未保存的草稿 ✏️')
    return
  }
  try {
    const place = await getFood(editingId)
    form.value = {
      name: place.name,
      category: place.category,
      status: place.status,
      rating: place.rating,
      location: place.location || '',
      hours: place.hours || '',
      note: place.note || '',
      visitedAt: place.visited_at || '',
      dishes: (place.dishes || []).map((d) => ({ ...d })),
      photos: (place.photos || []).map((p) => ({ ...p })),
    }
  } catch (e) {
    toast(e.message)
    goBack()
  }
})

function payload() {
  return {
    name: form.value.name.trim(),
    category: form.value.category,
    status: form.value.status,
    rating: form.value.rating,
    location: form.value.location.trim(),
    hours: form.value.hours.trim(),
    note: form.value.note.trim(),
    visitedAt: form.value.visitedAt || null,
    dishes: form.value.dishes
      .filter((d) => String(d.name || '').trim())
      .map((d) => ({
        id: d.id,
        name: d.name.trim(),
        rating: d.rating ?? null,
        note: String(d.note || '').trim(),
        price: d.price === '' || d.price === null || d.price === undefined ? null : Number(d.price),
        photos: (d.photos || []).map((p) => p.id).filter(Boolean),
      })),
    photos: form.value.photos.map((p) => p.id).filter(Boolean),
  }
}

async function save() {
  if (busy.value) return
  if (!form.value.name.trim()) return toast('请填写店名')
  const blankDish = form.value.dishes.findIndex((d) => !String(d.name || '').trim())
  if (blankDish >= 0) {
    dishRows.value?.focusRow(blankDish)
    return toast(`第 ${blankDish + 1} 道菜还没填菜名，请填写或删除该行`, 'error')
  }
  busy.value = true
  try {
    const data = payload()
    if (editingId) {
      await updateFood(editingId, data)
    } else {
      createKey ||= generateIdempotencyKey()
      await createFood(data, createKey)
      createKey = null
      clearFormDraft(DRAFT_KEY)
      draftRestored.value = false
    }
    toast(editingId ? '已更新' : '已记下')
    router.push('/foods')
  } catch (e) {
    toast(e.message)
  } finally {
    busy.value = false
  }
}

async function remove() {
  const ok = await confirmDialog({ title: '删除这家店', message: `确定删除「${form.value.name}」吗？` })
  if (!ok) return
  try {
    await removeFood(editingId)
    goBack()
  } catch (e) {
    toast(e.message)
  }
}

const categoryOptions = computed(() => FOOD_CATEGORIES)
</script>

<template>
  <div class="fade-up">
    <button class="btn-ghost mb-4 text-sm" @click="goBack">← 返回</button>
    <h1 class="serif mb-4 text-xl">{{ editingId ? '编辑美食' : '记一家店' }}</h1>

    <div v-if="draftRestored"
      class="surface-soft mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-xs text-theme-secondary">
      <span>✏️ 已恢复上次未保存的草稿</span>
      <button class="shrink-0 text-xs hover:text-theme-primary" @click="discardDraft">清空草稿</button>
    </div>

    <div class="food-form glass space-y-4 p-4 sm:p-5">
      <p class="text-sm font-medium text-theme-secondary">🏪 店铺信息</p>

      <!-- AI 粘贴成店（仅新建） -->
      <div v-if="!editingId" class="surface-soft rounded-xl p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-theme-secondary">🧠 粘贴探店笔记，AI 帮我填</span>
          <button class="shrink-0 text-xs text-accent" @click="aiOpen = !aiOpen">{{ aiOpen ? '收起' : '展开' }}</button>
        </div>
        <div v-if="aiOpen" class="mt-2 space-y-2">
          <textarea v-model="aiText" class="input-dark !px-3 !py-2 text-sm resize-none" rows="4" maxlength="800"
            placeholder="例如：老陈家炒河粉，晚上六点开门，炒河粉和牛腩粉超好吃…" />
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] leading-4 text-theme-tertiary">只把这段文字发给 DeepSeek，结果仅预填、不自动保存</span>
            <button class="btn-ghost !min-h-9 shrink-0 !px-3 text-xs"
              :disabled="aiBusy || !aiText.trim()" @click="generateDraft">
              {{ aiBusy ? '生成中…' : '生成草稿' }}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">店名</label>
        <input v-model="form.name" class="input-dark" maxlength="40" placeholder="比如：老陈家炒河粉" />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">分类</label>
          <AppSelect v-model="form.category" :options="categoryOptions" placeholder="选择分类" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">状态</label>
          <div class="flex gap-2">
            <button v-for="s in FOOD_STATUSES" :key="s.value"
              class="min-h-11 flex-1 touch-manipulation rounded-xl transition active:scale-95"
              :class="form.status === s.value ? 'bg-accent-soft text-accent' : 'surface-soft text-theme-secondary'"
              @click="form.status = s.value">
              {{ s.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">总体评分</label>
          <div class="flex min-h-11 items-center">
            <FoodRating v-model="form.rating" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">最近去 / 想去的日期</label>
          <AppDatePicker v-model="form.visitedAt" placeholder="选择日期（可空）" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">营业时间</label>
          <input v-model="form.hours" class="input-dark" maxlength="80" placeholder="10:30-21:00 周一休" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-theme-tertiary">地点</label>
          <input v-model="form.location" class="input-dark" maxlength="80" placeholder="店铺位置 / 商场几楼" />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">照片（最多 {{ MAX_PHOTOS }} 张）</label>
        <ImageUpload v-model="form.photos" accept="image" :max="MAX_PHOTOS" />
      </div>

      <div>
        <label class="mb-1 block text-xs text-theme-tertiary">总评（可空）</label>
        <textarea v-model="form.note" class="input-dark resize-none" rows="3" maxlength="1000"
          placeholder="锅气足，出餐快；下次想试牛腩粉" />
      </div>
    </div>

    <div class="food-form glass mt-4 p-4 sm:p-5">
      <p class="mb-1 text-sm font-medium text-theme-secondary">🍜 菜品</p>
      <p class="mb-3 text-[11px] text-theme-tertiary">招牌菜、吃过的都记在这里；每道菜可填价格、备注、评分与图片</p>
      <FoodDishRows ref="dishRows" :dishes="form.dishes" />
    </div>

    <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <button v-if="editingId" class="danger-link min-h-11 px-4 text-sm" @click="remove">删除</button>
      <button class="btn-ghost w-full sm:w-auto" @click="goBack">取消</button>
      <button class="btn-primary w-full sm:w-auto" :disabled="busy" @click="save">
        {{ busy ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
