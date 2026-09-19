import * as foodService from './food.service.js'

export async function list(req, res, next) {
  try { res.success(foodService.list(req.query, req.user.id)) } catch (e) { next(e) }
}

export async function map(req, res, next) {
  try { res.success(foodService.mapPoints(req.user.id)) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(foodService.getDetail(req.params.id, req.user.id)) } catch (e) { next(e) }
}

export async function listMoments(req, res, next) {
  try { res.success(foodService.listMoments(req.params.id, req.user.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(foodService.create(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function update(req, res, next) {
  try { res.success(foodService.update(req.params.id, req.user.id, req.body)) } catch (e) { next(e) }
}

export async function setStatus(req, res, next) {
  try { res.success(foodService.setStatus(req.params.id, req.user.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(foodService.remove(req.params.id, req.user.id)) } catch (e) { next(e) }
}
