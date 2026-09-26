import * as readService from './read.service.js'

export async function summary(req, res, next) {
  try { res.success(readService.summary(req.user.id)) } catch (e) { next(e) }
}

export async function markRead(req, res, next) {
  try { res.success(readService.markRead(req.user.id, req.params.module)) } catch (e) { next(e) }
}
