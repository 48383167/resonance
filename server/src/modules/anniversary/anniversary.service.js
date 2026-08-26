import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { localDateStr } from '../../common/utils/date.js'
import * as anniversaryRepository from './anniversary.repository.js'
import * as anniversarySchema from './anniversary.schema.js'

// 纪念日计算：距今天数 / 已在一起天数 / 是否今天（统一本地时区）
function toVO(a) {
  const today = new Date()
  const todayStr = localDateStr()
  const date = new Date(a.date)
  const daysSince = Math.floor((new Date(todayStr) - date) / 86400000)
  let daysUntil = -1
  let isToday = false
  const thisYear = new Date(today.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((thisYear - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
  if (diff === 0) { daysUntil = 0; isToday = true }
  else if (diff < 0) {
    const nextYear = new Date(today.getFullYear() + 1, date.getMonth(), date.getDate())
    daysUntil = Math.round((nextYear - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
  } else daysUntil = diff
  return { ...a, daysUntil, daysSince: Math.max(0, daysSince), isToday }
}

export function list() {
  return anniversaryRepository.list().map(toVO)
}

export function getDetail(id) {
  const a = anniversaryRepository.findById(id)
  if (!a) throw new NotFoundError('纪念日不存在')
  return toVO(a)
}

export function create(raw) {
  return toVO(anniversaryRepository.create(anniversarySchema.validateCreate(raw)))
}

export function update(id, raw) {
  const a = anniversaryRepository.findById(id)
  if (!a) throw new NotFoundError('纪念日不存在')
  return toVO(anniversaryRepository.update(id, raw))
}

export function remove(id) {
  anniversaryRepository.remove(id)
  return null
}
