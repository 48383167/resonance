import * as suggestionService from './suggestion.service.js'

export async function analyze(req, res, next) {
  try { res.success(await suggestionService.analyze(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function latest(req, res, next) {
  try { res.success(suggestionService.latest(req.user.id, req.query)) } catch (e) { next(e) }
}
