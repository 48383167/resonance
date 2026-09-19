<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { MAX_DISHES } from '../food.constants.js'
import FoodRating from './FoodRating.vue'

// 菜品行编辑器：每道菜两行（名称/价格 + 备注/评分），可增删
// 约定：dishes 由父组件持有，本组件直接增删改其中的行
const props = defineProps({
  dishes: { type: Array, required: true },
  max: { type: Number, default: MAX_DISHES },
})

let seq = 0
const rowKey = () => `dish_${Date.now().toString(36)}_${++seq}`

const listEl = ref(null)

onMounted(() => {
  for (const dish of props.dishes) if (!dish._key) dish._key = rowKey()
})

function addDish() {
  if (props.dishes.length >= props.max) return
  props.dishes.push({ _key: rowKey(), name: '', rating: null, note: '', price: null })
  nextTick(() => {
    const inputs = listEl.value?.querySelectorAll('input[data-dish-name]')
    inputs?.[inputs.length - 1]?.focus()
  })
}

function removeDish(index) {
  props.dishes.splice(index, 1)
}
</script>

<template>
  <div>
    <label class="mb-1 block text-xs text-theme-tertiary">招牌菜 / 吃过什么</label>

    <div ref="listEl" class="surface-soft space-y-2 rounded-xl p-2.5 sm:p-3">
      <div v-for="(dish, i) in dishes" :key="dish._key || dish.id || i"
        class="rounded-xl bg-white/[0.04] p-2.5">
        <div class="flex items-center gap-2">
          <span class="w-5 shrink-0 text-right text-[10px] tabular-nums text-theme-tertiary">{{ i + 1 }}</span>
          <input v-model="dish.name" data-dish-name class="input-dark !min-h-10 min-w-0 flex-1 !px-3 !py-1.5 text-sm"
            maxlength="20" placeholder="菜名，比如：炒河粉" />
          <input v-model.number="dish.price" type="number" min="0" max="9999"
            class="input-dark !min-h-10 w-20 shrink-0 !px-2 !py-1.5 text-center text-sm" placeholder="¥" />
          <button class="min-h-10 min-w-8 shrink-0 text-base text-theme-tertiary transition-colors hover:text-accent"
            title="删除这道菜" @click="removeDish(i)">⊖</button>
        </div>
        <div class="mt-2 flex items-center gap-2 pl-7">
          <input v-model="dish.note" class="input-dark !min-h-9 min-w-0 flex-1 !px-3 !py-1 text-xs"
            maxlength="50" placeholder="备注（可空）：锅气足 / 有点咸" />
          <FoodRating v-model="dish.rating" />
        </div>
      </div>

      <p v-if="!dishes.length" class="px-1 py-2 text-center text-xs text-theme-tertiary">
        还没有菜品，点下面「添加一道菜」
      </p>
    </div>

    <div class="mt-2 flex items-center justify-between">
      <button class="min-h-10 rounded-lg px-2 text-sm text-accent" @click="addDish">＋ 添加一道菜</button>
      <span class="text-xs" :class="dishes.length >= max ? 'danger-link' : 'text-theme-tertiary'">
        已 {{ dishes.length }} 道（最多 {{ max }} 道）
      </span>
    </div>
  </div>
</template>
