import { AppError } from '../../common/errors/AppError.js'
import { COMPANION_DAILY_MODEL_REPLY_LIMIT } from '../../config/companion.js'
import { transaction } from '../../config/database.js'
import { assertDeepSeekConfigured, createEmotionalReply, createConversationTitle } from '../../infrastructure/ai/deepseek.adapter.js'
import {
  CONVERSATION_TITLE_MAX_LENGTH,
  CRISIS_RESPONSE,
  DEFAULT_CONVERSATION_TITLE,
  isImmediateCrisis,
  LOCAL_SAFETY_MODEL,
} from './companion.policy.js'
import * as companionRepository from './companion.repository.js'
import * as companionSchema from './companion.schema.js'

const MAX_ENABLED_MEMORIES = 8
const TITLE_FALLBACK_LENGTH = 14

// 模型标题清洗：单行、去引号与首尾标点，超长截断；空结果交由兜底处理
function normalizeGeneratedTitle(raw) {
  if (typeof raw !== 'string') return ''
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’《〈【（(]+/, '')
    .replace(/["'“”‘’》〉】）)]+$/, '')
    .replace(/[。！？!?，,、；;：:~～\-—…]+$/, '')
    .trim()
  return cleaned ? cleaned.slice(0, CONVERSATION_TITLE_MAX_LENGTH) : ''
}

// 兜底标题：单行化后截取首句前 14 字；空白内容保持默认标题
function fallbackConversationTitle(content) {
  const cleaned = String(content || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return DEFAULT_CONVERSATION_TITLE
  return cleaned.length > TITLE_FALLBACK_LENGTH
    ? `${cleaned.slice(0, TITLE_FALLBACK_LENGTH)}…`
    : cleaned
}

function conversationOrThrow(ownerId, conversationId) {
  const found = companionRepository.findConversation(ownerId, conversationId)
  if (!found) {
    // 与不存在使用同一错误，防止通过 ID 探测另一位用户的私有会话。
    throw new AppError('情感对话不存在', 404, 'COMPANION_CONVERSATION_NOT_FOUND')
  }
  return found
}

function assertConsent(ownerId) {
  if (!companionRepository.getConsent(ownerId).consented) {
    throw new AppError('请先同意第三方模型处理说明', 403, 'COMPANION_CONSENT_REQUIRED')
  }
}

function memoryOrThrow(ownerId, memoryId) {
  const found = companionRepository.findMemory(ownerId, memoryId)
  if (!found) {
    // 与不存在使用同一错误，避免通过 ID 探测其他用户的私有记忆。
    throw new AppError('个人记忆不存在', 404, 'COMPANION_MEMORY_NOT_FOUND')
  }
  return found
}

function assertEnabledMemoryCapacity(ownerId) {
  if (companionRepository.countEnabledMemories(ownerId) >= MAX_ENABLED_MEMORIES) {
    throw new AppError(`最多只能启用 ${MAX_ENABLED_MEMORIES} 条个人记忆，请先暂停一条再继续`, 400, 'COMPANION_ACTIVE_MEMORY_LIMIT')
  }
}

export function getConsent(ownerId) {
  return companionRepository.getConsent(ownerId)
}

export function updateConsent(ownerId, raw) {
  const { accepted } = companionSchema.validateConsent(raw)
  return companionRepository.setConsent(ownerId, accepted)
}

export function listConversations(ownerId) {
  return companionRepository.listConversations(ownerId)
}

export function listMemories(ownerId) {
  return companionRepository.listMemories(ownerId)
}

export function createMemory(ownerId, raw) {
  const { content } = companionSchema.validateCreateMemory(raw)
  return transaction(() => {
    assertEnabledMemoryCapacity(ownerId)
    return companionRepository.createMemory(ownerId, content)
  })
}

export function updateMemory(ownerId, memoryId, raw) {
  const changes = companionSchema.validateUpdateMemory(raw)
  const current = memoryOrThrow(ownerId, memoryId)
  if (changes.enabled === true && !current.enabled) {
    return transaction(() => {
      assertEnabledMemoryCapacity(ownerId)
      return companionRepository.updateMemory(ownerId, memoryId, changes)
    })
  }
  return companionRepository.updateMemory(ownerId, memoryId, changes)
}

export function removeMemory(ownerId, memoryId) {
  memoryOrThrow(ownerId, memoryId)
  transaction(() => companionRepository.removeMemory(ownerId, memoryId))
  return null
}

export function createConversation(ownerId, raw) {
  const { title } = companionSchema.validateCreateConversation(raw)
  return companionRepository.createConversation(ownerId, title)
}

export function getConversation(ownerId, conversationId) {
  const found = conversationOrThrow(ownerId, conversationId)
  return { conversation: found, messages: companionRepository.listMessages(ownerId, conversationId) }
}

export async function createMessage(ownerId, conversationId, raw) {
  const { content } = companionSchema.validateMessage(raw)
  const conversation = conversationOrThrow(ownerId, conversationId)
  assertConsent(ownerId)

  // 自动命名：标题仍是默认值时触发；模型标题只在首条消息时生成
  const needsTitle = !conversation.title || conversation.title === DEFAULT_CONVERSATION_TITLE
  const isFirstMessage = needsTitle && !companionRepository.hasAnyMessage(ownerId, conversationId)
  const crisis = isImmediateCrisis(content)

  let answer
  let model = LOCAL_SAFETY_MODEL
  let promptTokens = 0
  let completionTokens = 0
  let generatedTitle = ''

  if (crisis) {
    // 即时危机文本不离开本服务；用确定性安全回复优先引导现实中的帮助。
    answer = CRISIS_RESPONSE
  } else {
    // 密钥不存在时不预留额度；正常请求在出站前原子占位，防止删除/并发绕过日限额。
    assertDeepSeekConfigured()
    const reservation = companionRepository.reserveModelReply(ownerId, COMPANION_DAILY_MODEL_REPLY_LIMIT)
    if (!reservation.reserved) {
      throw new AppError('今天的情感咨询次数已用完，请明天再来聊聊', 429, 'COMPANION_RATE_LIMITED')
    }
    let reply
    // 标题与回复并行：标题是极小请求，通常先返回；若未及时返回则用首句兜底，绝不让回复等待标题
    const titlePromise = isFirstMessage
      ? createConversationTitle({ userId: ownerId, content }).catch(() => '')
      : Promise.resolve('')
    try {
      reply = await createEmotionalReply({
        userId: ownerId,
        messages: [...companionRepository.listRecentMessages(ownerId, conversationId), { role: 'user', content }],
        memoryContents: companionRepository.listEnabledMemoryContents(ownerId, MAX_ENABLED_MEMORIES),
      })
    } catch (error) {
      companionRepository.releaseModelReply(ownerId, reservation.usageDate)
      throw error
    }
    generatedTitle = normalizeGeneratedTitle(await Promise.race([
      titlePromise,
      new Promise((resolve) => { setTimeout(() => resolve(''), 0) }),
    ]))
    answer = reply.content
    model = reply.model
    promptTokens = reply.promptTokens
    completionTokens = reply.completionTokens
  }

  const result = transaction(() => {
    const userMessage = companionRepository.createMessage({ conversationId, role: 'user', content })
    const assistantMessage = companionRepository.createMessage({
      conversationId,
      role: 'assistant',
      content: answer,
      model,
      promptTokens,
      completionTokens,
    })
    companionRepository.touchConversation(ownerId, conversationId)
    if (needsTitle) {
      const title = generatedTitle
        || fallbackConversationTitle(
          isFirstMessage
            ? content
            : (companionRepository.firstUserMessageContent(ownerId, conversationId) || content)
        )
      companionRepository.setConversationTitle(ownerId, conversationId, title)
    }
    return {
      userMessage,
      assistantMessage,
      conversation: companionRepository.findConversation(ownerId, conversationId),
    }
  })

  return {
    ...result,
    remainingToday: Math.max(0, COMPANION_DAILY_MODEL_REPLY_LIMIT - companionRepository.countModelRepliesToday(ownerId)),
  }
}

// 启动时一次性回填历史会话标题：只处理标题仍为默认值且已有用户消息的会话。
// 幂等、不调用模型、不改变 updated_at，因此不会打乱会话列表排序。
export function backfillConversationTitles() {
  const rows = companionRepository.listDefaultTitledConversations()
  if (!rows.length) return 0
  transaction(() => {
    for (const row of rows) {
      companionRepository.setConversationTitle(row.owner_id, row.id, fallbackConversationTitle(row.first_content))
    }
  })
  return rows.length
}

export function removeConversation(ownerId, conversationId) {
  conversationOrThrow(ownerId, conversationId)
  transaction(() => companionRepository.removeConversation(ownerId, conversationId))
  return null
}
