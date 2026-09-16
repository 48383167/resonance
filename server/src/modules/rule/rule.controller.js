import * as ruleService from './rule.service.js'

export async function list(req, res, next) {
  try { res.success(ruleService.list(req.query, req.user.id)) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(ruleService.getDetail(req.params.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(ruleService.create(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function update(req, res, next) {
  try { res.success(ruleService.update(req.params.id, req.user.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(ruleService.remove(req.params.id, req.user.id)) } catch (e) { next(e) }
}

export async function toggleAgree(req, res, next) {
  try { res.success(ruleService.toggleAgree(req.params.id, req.user.id)) } catch (e) { next(e) }
}

export async function pendingCount(req, res, next) {
  try { res.success(ruleService.pendingCount(req.user.id)) } catch (e) { next(e) }
}
