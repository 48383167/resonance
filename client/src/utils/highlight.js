// 中文场景的简单子串高亮：返回 [{ text, hit }] 供模板渲染，不引分词依赖
export function highlightParts(text, keyword) {
  const source = String(text ?? '')
  const key = String(keyword ?? '').trim()
  if (!key) return [{ text: source, hit: false }]
  const lower = source.toLowerCase()
  const k = key.toLowerCase()
  const parts = []
  let from = 0
  while (from <= source.length) {
    const idx = lower.indexOf(k, from)
    if (idx < 0) {
      if (from < source.length) parts.push({ text: source.slice(from), hit: false })
      break
    }
    if (idx > from) parts.push({ text: source.slice(from, idx), hit: false })
    parts.push({ text: source.slice(idx, idx + k.length), hit: true })
    from = idx + k.length
  }
  return parts.filter((p) => p.text)
}
