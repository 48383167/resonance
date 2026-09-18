import { assertDeepSeekConfigured, createNotebookSuggestions } from '../../infrastructure/ai/deepseek.adapter.js'
import { getUserCouple } from '../couple/couple.service.js'
import * as careRepository from '../care/care.repository.js'
import * as ruleRepository from '../rule/rule.repository.js'
import * as ruleItems from '../rule/rule.items.js'
import * as suggestionRepository from './suggestion.repository.js'
import * as suggestionSchema from './suggestion.schema.js'
import { SUGGESTION_PROMPT_VERSION } from './suggestion.policy.js'
import { buildAnalysisPayload, contentHashOf, parseSuggestions } from './suggestion.format.js'

// AI 整理建议：只读档案 / 规矩的标题与条目文本，结果按情侣空间共享。
// 内容哈希未变时直接复用缓存；不做每日次数限制，调用频率由「内容变化」天然约束。
function scopeOf(userId, couple) {
  return couple?.pairCode ? `pair:${couple.pairCode}` : `solo:${userId}`
}

// 档案 / 规矩当前没有 couple 列，按「作者属于本情侣空间」过滤，避免把别人的数据送出。
// 例假（category = period）有独立 Tab，不参与档案建议，否则建议会指向该页看不到的条目。
function gatherItems(userId, couple, target) {
  const members = new Set(couple ? couple.members.map((m) => m.id) : [userId])
  if (target === 'care') {
    return careRepository.list({})
      .filter((item) => members.has(item.author_id) && item.category !== 'period')
  }
  return ruleRepository.list({ status: 'active' })
    .filter((rule) => members.has(rule.author_id))
    .map((rule) => ({ ...rule, items: ruleItems.itemsFromRow(rule) }))
}

function toResponse(row, cached) {
  const parsed = JSON.parse(row.result_json || '{}')
  return {
    target: row.target,
    suggestions: parsed.suggestions || [],
    createdAt: row.updated_at || row.created_at,
    cached,
  }
}

export async function analyze(userId, raw) {
  const { target } = suggestionSchema.validateTarget(raw)
  const couple = getUserCouple(userId)
  const scope = scopeOf(userId, couple)
  const { data, refs } = buildAnalysisPayload(target, gatherItems(userId, couple, target))

  // 没有可分析的条目：直接给空结果，不调用模型、不占额度
  if (!refs.length) {
    return { target, suggestions: [], createdAt: null, cached: false, empty: true }
  }

  const contentHash = contentHashOf(data, SUGGESTION_PROMPT_VERSION)
  const cached = suggestionRepository.findLatest(scope, target)
  if (cached && cached.content_hash === contentHash) return toResponse(cached, true)

  assertDeepSeekConfigured()
  const rawText = await createNotebookSuggestions({ userId, target, data })

  suggestionRepository.upsert(scope, target, contentHash, { suggestions: parseSuggestions(rawText, refs) })
  return toResponse(suggestionRepository.findLatest(scope, target), false)
}

export function latest(userId, query = {}) {
  const { target } = suggestionSchema.validateTarget(query)
  const couple = getUserCouple(userId)
  const row = suggestionRepository.findLatest(scopeOf(userId, couple), target)
  return row
    ? toResponse(row, true)
    : { target, suggestions: [], createdAt: null, cached: true, empty: true }
}
