import { reactive } from 'vue'

// 主题化二次确认框（替代原生 confirm）
// requireText 非空时为高危操作：需手动输入指定文本（如相册名）才可确认
export const confirmState = reactive({
  open: false,
  title: '确认操作',
  message: '',
  danger: true,
  requireText: '',
  inputValue: '',
  resolve: null,
})

export function confirmDialog({ title = '确认操作', message = '', danger = true, requireText = '' } = {}) {
  return new Promise((resolve) => {
    confirmState.title = title
    confirmState.message = message
    confirmState.danger = danger
    confirmState.requireText = requireText
    confirmState.inputValue = ''
    confirmState.resolve = resolve
    confirmState.open = true
  })
}
