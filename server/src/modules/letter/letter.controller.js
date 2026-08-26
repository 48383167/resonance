import * as letterService from './letter.service.js'

export async function list(req, res, next) {
  try { res.success(letterService.list()) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(letterService.getDetail(req.user.id, req.params.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(letterService.create(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function update(req, res, next) {
  try { res.success(letterService.update(req.user.id, req.params.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(letterService.remove(req.params.id)) } catch (e) { next(e) }
}
