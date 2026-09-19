import { reactive } from 'vue'

// 主题化二次确认框（替代原生 confirm）
// requireText 非空时为高危操作：需手动输入指定文本（如相册名）才可确认
// dateMode 为日期选择模式：确认后返回所选 YYYY-MM-DD，取消返回 null
export const confirmState = reactive({
  open: false,
  title: '确认操作',
  message: '',
  danger: true,
  requireText: '',
  inputValue: '',
  dateMode: false,
  dateValue: '',
  dateConfirmText: '确认',
  resolve: null,
})

export function confirmDialog({ title = '确认操作', message = '', danger = true, requireText = '' } = {}) {
  return new Promise((resolve) => {
    confirmState.title = title
    confirmState.message = message
    confirmState.danger = danger
    confirmState.requireText = requireText
    confirmState.inputValue = ''
    confirmState.dateMode = false
    confirmState.dateValue = ''
    confirmState.dateConfirmText = '确认'
    confirmState.resolve = resolve
    confirmState.open = true
  })
}

// 日期选择确认框：确认返回 'YYYY-MM-DD'，取消返回 null
export function promptDateDialog({ title = '选择日期', message = '', defaultDate = '', confirmText = '确认' } = {}) {
  return new Promise((resolve) => {
    confirmState.title = title
    confirmState.message = message
    confirmState.danger = false
    confirmState.requireText = ''
    confirmState.inputValue = ''
    confirmState.dateMode = true
    confirmState.dateValue = defaultDate
    confirmState.dateConfirmText = confirmText
    confirmState.resolve = (value) => resolve(value ? confirmState.dateValue : null)
    confirmState.open = true
  })
}
