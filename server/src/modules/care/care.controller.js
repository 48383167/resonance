import * as careService from './care.service.js'

export async function list(req, res, next) {
  try { res.success(careService.list(req.query)) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(careService.getDetail(req.params.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(careService.create(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function update(req, res, next) {
  try { res.success(careService.update(req.params.id, req.user.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(careService.remove(req.params.id, req.user.id)) } catch (e) { next(e) }
}

export async function periodSummary(req, res, next) {
  try { res.success(careService.periodSummary(req.user.id)) } catch (e) { next(e) }
}
