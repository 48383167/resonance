// 美食模块共享常量：分类 / 状态 / 数量上限
export const MAX_DISHES = 20
export const MAX_PHOTOS = 9
export const PAGE_SIZE = 20

export const FOOD_CATEGORIES = [
  { value: 'snack', label: '小吃' },
  { value: 'meal', label: '正餐' },
  { value: 'hotpot', label: '火锅' },
  { value: 'bbq', label: '烧烤' },
  { value: 'dessert', label: '甜品' },
  { value: 'drink', label: '饮品' },
  { value: 'other', label: '其他' },
]
export const CATEGORY_LABELS = Object.fromEntries(FOOD_CATEGORIES.map((c) => [c.value, c.label]))

export const FOOD_STATUSES = [
  { value: 'want', label: '想去' },
  { value: 'visited', label: '去过' },
  { value: 'favorite', label: '常去' },
]
export const STATUS_LABELS = Object.fromEntries(FOOD_STATUSES.map((s) => [s.value, s.label]))
export const STATUS_CLASSES = {
  want: 'surface-soft text-theme-secondary',
  visited: 'bg-accent-soft text-accent',
  favorite: 'bg-accent-soft text-accent',
}
