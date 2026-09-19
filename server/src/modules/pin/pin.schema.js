import { AppError } from '../../common/errors/AppError.js'

const TARGET_TYPES = ['care', 'rule', 'food']
const SCOPES = ['none', 'list', 'global']

export function validateSetPin(body = {}) {
  const { targetType, targetId, scope } = body
  if (!TARGET_TYPES.includes(targetType)) throw new AppError('置顶类型不支持', 400, 'INVALID_PIN_TARGET_TYPE')
  if (!SCOPES.includes(scope)) throw new AppError('置顶级别非法', 400, 'INVALID_PIN_SCOPE')
  return { targetType, targetId, scope }
}
