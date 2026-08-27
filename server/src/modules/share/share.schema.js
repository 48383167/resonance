import { BadRequestError } from '../../common/errors/BadRequestError.js'

// 分享链接内容范围开关（camelCase 请求字段 ↔ snake_case 数据库列）
const INCLUDE_KEYS = ['includeMoments', 'includeEntries', 'includeAnniversaries']

// 校验三个布尔开关；defaultMissing=true 时缺省补 true（创建），否则只保留已提交字段（更新）
function validateIncludeFlags(body = {}, { defaultMissing } = {}) {
  const out = {}
  for (const key of INCLUDE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (typeof body[key] !== 'boolean') {
        throw new BadRequestError(`${key} 必须是布尔值`)
      }
      out[key] = body[key]
    } else if (defaultMissing) {
      out[key] = true
    }
  }
  return out
}

// 创建：三个开关缺省均为 true
export function validateCreate(body = {}) {
  return validateIncludeFlags(body, { defaultMissing: true })
}

// 更新：缺省字段保持当前值（仅返回本次已提交的字段）
export function validateUpdate(body = {}) {
  return validateIncludeFlags(body, { defaultMissing: false })
}
