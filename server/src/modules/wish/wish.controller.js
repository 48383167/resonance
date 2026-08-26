import * as wishService from './wish.service.js'

export async function list(req, res, next) {
  try { res.success(wishService.list()) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(wishService.getDetail(req.params.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(wishService.create(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function update(req, res, next) {
  try { res.success(wishService.update(req.params.id, req.body)) } catch (e) { next(e) }
}

export async function setStatus(req, res, next) {
  try { res.success(wishService.setStatus(req.params.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(wishService.remove(req.params.id)) } catch (e) { next(e) }
}
