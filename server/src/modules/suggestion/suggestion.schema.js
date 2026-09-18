import { AppError } from '../../common/errors/AppError.js'

const TARGETS = ['care', 'rule']

export function validateTarget(raw = {}) {
  const target = raw.target
  if (!TARGETS.includes(target)) {
    throw new AppError('分析对象非法', 400, 'INVALID_SUGGESTION_TARGET')
  }
  return { target }
}
