import { FOOD_CATEGORIES } from './food.schema.js'

// AI 草稿解析（纯函数）：模型输出只用于预填表单，这里做白名单校验与截断，
// 任何越界/编造外的脏数据都会被安全丢弃；整体无法解析时返回 null。
const CATEGORY_VALUES = new Set(FOOD_CATEGORIES)
const MAX_DISHES = 10

function text(value, max) {
  const s = value == null ? '' : String(value).trim()
  return s.length > max ? s.slice(0, max) : s
}

function rating(value) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

function price(value) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null
}

// 草稿场景：未提及的价格模型常回 0，视为未填（0 元餐品极少，正式表单仍允许 0）
function draftPrice(value) {
  const n = price(value)
  return n && n > 0 ? n : null
}

export function parseFoodDraft(raw) {
  const text0 = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed
  try {
    parsed = JSON.parse(text0)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const dishes = Array.isArray(parsed.dishes) ? parsed.dishes : []
  return {
    name: text(parsed.name, 40),
    category: CATEGORY_VALUES.has(parsed.category) ? parsed.category : 'other',
    rating: rating(parsed.rating),
    hours: text(parsed.hours, 80),
    phone: text(parsed.phone, 30),
    avgPrice: draftPrice(parsed.avgPrice),
    location: text(parsed.location, 80),
    note: text(parsed.note, 1000),
    dishes: dishes
      .map((dish) => ({
        name: text(dish?.name, 20),
        rating: rating(dish?.rating),
        note: text(dish?.note, 50),
        price: draftPrice(dish?.price),
      }))
      .filter((dish) => dish.name)
      .slice(0, MAX_DISHES),
  }
}
