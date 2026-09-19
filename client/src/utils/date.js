// 本地时区的今天（YYYY-MM-DD），与后端 common/utils/date.js 的 localDateStr 语义一致
export function localDateStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
