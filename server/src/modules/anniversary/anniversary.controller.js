import * as anniversaryService from './anniversary.service.js'

export async function list(req, res, next) {
  try { res.success(anniversaryService.list()) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(anniversaryService.getDetail(req.params.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(anniversaryService.create(req.body)) } catch (e) { next(e) }
}

export async function update(req, res, next) {
  try { res.success(anniversaryService.update(req.params.id, req.body)) } catch (e) { next(e) }
}

export async function updateShareVisibility(req, res, next) {
  try { res.success(anniversaryService.updateShareVisibility(req.params.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(anniversaryService.remove(req.params.id)) } catch (e) { next(e) }
}
