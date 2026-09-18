import { createHash } from 'node:crypto'
import {
  SUGGESTION_MAX_CARE_ITEMS,
  SUGGESTION_MAX_RULES,
  SUGGESTION_MAX_RULE_TEXTS,
  SUGGESTION_TEXT_MAX_LENGTH,
} from '../../config/suggestion.js'
import {
  SUGGESTION_MAX_ITEMS,
  SUGGESTION_REASON_MAX_LENGTH,
  SUGGESTION_TYPES,
  suggestionLevel,
} from './suggestion.policy.js'

// 出站载荷与结果解析的纯函数：方便单测，也把「什么数据会离开服务器」收敛在一处。
export function clip(text, max = SUGGESTION_TEXT_MAX_LENGTH) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) : s
}

// 分类与严重程度用中文标签出站，避免模型对 diet/allergy 等代码产生误解
const CATEGORY_LABELS = { diet: '忌口', allergy: '过敏', preference: '偏好', other: '其他' }
const SEVERITY_LABELS = { mild: '轻度', moderate: '中度', severe: '重度' }

function activeRuleTexts(rule) {
  let items = rule.items
  if (typeof items === 'string') {
    try { items = JSON.parse(items) } catch { items = [] }
  }
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.state !== 'archived' && it.text)
    .slice(0, SUGGESTION_MAX_RULE_TEXTS)
    .map((it) => clip(it.text))
    .filter(Boolean)
}

// 构造出站数据 + 本地映射：
//   - care：只发标题 / 分类 / 严重程度
//   - rule：发标题 + 少量 active 条目文本
// refs[i] 用于把模型返回的 index 映射回真实资源，供前端跳转。
export function buildAnalysisPayload(target, items) {
  if (target === 'care') {
    const picked = (items || []).slice(0, SUGGESTION_MAX_CARE_ITEMS)
    return {
      data: {
        kind: 'care',
        items: picked.map((item, index) => ({
          index,
          title: clip(item.title),
          category: CATEGORY_LABELS[item.category] || item.category,
          ...(item.severity ? { severity: SEVERITY_LABELS[item.severity] || item.severity } : {}),
        })),
      },
      refs: picked.map((item) => ({ id: item.id, title: clip(item.title, 80) })),
    }
  }

  const picked = (items || []).slice(0, SUGGESTION_MAX_RULES)
  return {
    data: {
      kind: 'rule',
      items: picked.map((rule, index) => ({
        index,
        title: clip(rule.title),
        texts: activeRuleTexts(rule),
      })),
    },
    refs: picked.map((rule) => ({ id: rule.id, title: clip(rule.title, 80) })),
  }
}

// 内容哈希：提示词版本也参与，改提示词后旧缓存自动失效
export function contentHashOf(data, version = 1) {
  return createHash('sha256').update(JSON.stringify({ v: version, data })).digest('hex')
}

// 模型输出 → 可信结果：剥代码块、解析 JSON、逐条校验类型与索引，脏数据直接丢弃。
export function parseSuggestions(raw, refs = []) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const type = entry.type
    if (!SUGGESTION_TYPES.includes(type)) continue
    const reason = clip(entry.reason, SUGGESTION_REASON_MAX_LENGTH)
    if (!reason) continue
    const indexes = Array.isArray(entry.refs)
      ? [...new Set(entry.refs.filter((i) => Number.isInteger(i) && i >= 0 && i < refs.length))]
      : []
    if (!indexes.length) continue
    out.push({
      id: `sg_${out.length + 1}`,
      type,
      level: suggestionLevel(type),
      reason,
      refs: indexes.map((i) => refs[i]),
    })
    if (out.length >= SUGGESTION_MAX_ITEMS) break
  }
  return out
}
