import { AppError } from '../../common/errors/AppError.js'
import { COMPANION_DAILY_MODEL_REPLY_LIMIT } from '../../config/companion.js'
import { transaction } from '../../config/database.js'
import { assertDeepSeekConfigured, createEmotionalReply } from '../../infrastructure/ai/deepseek.adapter.js'
import { CRISIS_RESPONSE, isImmediateCrisis, LOCAL_SAFETY_MODEL } from './companion.policy.js'
import * as companionRepository from './companion.repository.js'
import * as companionSchema from './companion.schema.js'

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
  conversationOrThrow(ownerId, conversationId)
  assertConsent(ownerId)

  let answer
  let model = LOCAL_SAFETY_MODEL
  let promptTokens = 0
  let completionTokens = 0

  if (isImmediateCrisis(content)) {
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
    try {
      reply = await createEmotionalReply({
        userId: ownerId,
        messages: [...companionRepository.listRecentMessages(ownerId, conversationId), { role: 'user', content }],
      })
    } catch (error) {
      companionRepository.releaseModelReply(ownerId, reservation.usageDate)
      throw error
    }
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
    return { userMessage, assistantMessage }
  })

  return {
    ...result,
    remainingToday: Math.max(0, COMPANION_DAILY_MODEL_REPLY_LIMIT - companionRepository.countModelRepliesToday(ownerId)),
  }
}

export function removeConversation(ownerId, conversationId) {
  conversationOrThrow(ownerId, conversationId)
  transaction(() => companionRepository.removeConversation(ownerId, conversationId))
  return null
}
