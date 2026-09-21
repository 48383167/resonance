<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { MAX_DISHES, MAX_DISH_PHOTOS } from '../food.constants.js'
import ImageUpload from '../../../shared/components/ImageUpload.vue'
import FoodRating from './FoodRating.vue'

// 菜品行编辑器：每道菜（名称/价格 + 备注 + 评分/图片），可增删
// 约定：dishes 由父组件持有，本组件直接增删改其中的行
const props = defineProps({
  dishes: { type: Array, required: true },
  max: { type: Number, default: MAX_DISHES },
})

let seq = 0
const rowKey = () => `dish_${Date.now().toString(36)}_${++seq}`

const listEl = ref(null)

onMounted(() => {
  for (const dish of props.dishes) {
    if (!dish._key) dish._key = rowKey()
    if (!Array.isArray(dish.photos)) dish.photos = []
  }
})

function addDish() {
  if (props.dishes.length >= props.max) return
  props.dishes.push({ _key: rowKey(), name: '', rating: null, note: '', price: null, photos: [] })
  nextTick(() => {
    const inputs = listEl.value?.querySelectorAll('input[data-dish-name]')
    inputs?.[inputs.length - 1]?.focus()
  })
}

function removeDish(index) {
  props.dishes.splice(index, 1)
}

// 菜名回车 → 跳到同一行价格（手机键盘「下一项」）
function focusPrice(event) {
  if (event.isComposing) return
  event.preventDefault()
  event.target.nextElementSibling?.focus()
}

// 保存被拦截时定位到指定菜名输入
function focusRow(index) {
  nextTick(() => {
    const inputs = listEl.value?.querySelectorAll('input[data-dish-name]')
    inputs?.[index]?.focus()
  })
}

defineExpose({ focusRow })
</script>

<template>
  <div>
    <div ref="listEl" class="space-y-3">
      <div v-for="(dish, i) in dishes" :key="dish._key || dish.id || i"
        class="group surface-card rounded-2xl border border-theme p-3 shadow-sm transition sm:p-4">
        <!-- 名称、备注、评分/图片分层，避免桌面端长输入挤压备注信息 -->
        <div class="flex items-center gap-2">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-medium tabular-nums text-accent group-focus-within:hidden">
            {{ i + 1 }}
          </span>
          <div class="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <input v-model="dish.name" data-dish-name
              class="input-dark !min-h-10 w-full touch-manipulation scroll-mb-32 !px-3 !py-1.5 text-sm"
              maxlength="20" placeholder="菜名，比如：炒河粉" enterkeyhint="next" @keydown.enter="focusPrice" />
          </div>
          <input v-model.number="dish.price" type="number" min="0" max="9999" inputmode="decimal" enterkeyhint="done"
            class="input-dark !min-h-10 !w-20 shrink-0 touch-manipulation scroll-mb-32 !px-2 !py-1.5 text-center text-sm"
            placeholder="价格" />
          <button type="button"
            class="min-h-10 min-w-9 shrink-0 touch-manipulation text-base text-theme-tertiary transition-colors hover:text-accent active:scale-90"
            title="删除这道菜" @click="removeDish(i)">⊖</button>
        </div>
        <div class="mt-2 pl-7">
          <input v-model="dish.note" enterkeyhint="done"
            class="input-dark !min-h-9 min-w-0 w-full touch-manipulation scroll-mb-32 !px-3 !py-1 text-xs"
            maxlength="50" placeholder="备注（可空）：锅气足 / 有点咸" />
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-3 pl-7">
          <FoodRating v-model="dish.rating" dense class="shrink-0" />
          <ImageUpload v-model="dish.photos" compact accept="image" :max="MAX_DISH_PHOTOS" class="min-w-0" />
        </div>
      </div>

      <p v-if="!dishes.length" class="px-1 py-2 text-center text-xs text-theme-tertiary">
        还没有菜品，点下面「添加一道菜」
      </p>
    </div>

    <div class="mt-2 flex items-center justify-between">
      <button type="button" class="min-h-10 rounded-lg px-2 text-sm text-accent touch-manipulation active:scale-95" @click="addDish">＋ 添加一道菜</button>
      <span class="text-xs" :class="dishes.length >= max ? 'danger-link' : 'text-theme-tertiary'">
        已 {{ dishes.length }} 道（最多 {{ max }} 道）
      </span>
    </div>
  </div>
</template>
