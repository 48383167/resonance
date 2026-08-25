import { reactive } from 'vue'

export const toasts = reactive([])

export function toast(message, type = 'info') {
  const id = Date.now() + Math.random()
  toasts.push({ id, message, type })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, 4200)
}
