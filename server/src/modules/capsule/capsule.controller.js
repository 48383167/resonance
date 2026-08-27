import * as capsuleService from './capsule.service.js'

export async function list(req, res, next) {
  try { res.success(capsuleService.list()) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(capsuleService.getDetail(req.params.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(capsuleService.create(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(capsuleService.remove(req.user.id, req.params.id)) } catch (e) { next(e) }
}
