// 本地时区的今天（YYYY-MM-DD），纪念日/胶囊等日期比较统一用它
export function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
