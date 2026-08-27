import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { name, coverFileId, description } = body
  if (!name || !String(name).trim()) throw new BadRequestError('相册名不能为空')
  return { name, coverFileId, description }
}

export function validateUpdate(body = {}) {
  const { name, description } = body
  if (name != null && !String(name).trim()) throw new BadRequestError('相册名不能为空')
  return { name, description }
}

export function validatePhoto(body = {}) {
  const { fileId, caption } = body
  if (!fileId) throw new BadRequestError('文件 ID 不能为空')
  return { fileId: String(fileId), caption }
}

export function validateCover(body = {}) {
  const { fileId } = body
  if (!fileId) throw new BadRequestError('封面文件 ID 不能为空')
  return { fileId: String(fileId) }
}

export function validateObservatory(body = {}) {
  const { showInObservatory } = body
  if (typeof showInObservatory !== 'boolean') {
    throw new BadRequestError('showInObservatory 必须为布尔值')
  }
  return { showInObservatory }
}
