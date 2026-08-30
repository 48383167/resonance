import * as observatoryService from './observatory.service.js'

export function getObservatory(req, res) {
  res.success(observatoryService.getObservatory())
}

// 内部观测台（认证）：登录用户始终可见已勾选照片
export function getInternalObservatory(req, res, next) {
  try { res.success(observatoryService.getInternalObservatory()) } catch (e) { next(e) }
}

// 更新观测台总展示开关（认证）
export function setVisibility(req, res, next) {
  try { res.success(observatoryService.setVisibility(req.body)) } catch (e) { next(e) }
}

// 分享页特殊契约：needPassword 顶层标记、410 过期、404 停用（保持原 API 兼容）
export function getShare(req, res) {
  const result = observatoryService.getShare(req.params.token, req.query.password)
  if (result.status === 'not_found') return res.status(404).json({ ok: false, error: '分享链接不存在或已停用' })
  if (result.status === 'expired') return res.status(410).json({ ok: false, error: '分享链接已过期' })
  if (result.status === 'need_password') return res.status(401).json({ ok: false, error: '需要密码', needPassword: true })
  res.success(result.data)
}
