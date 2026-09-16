import * as navigationService from './navigation.service.js'

export async function getSettings(req, res, next) {
  try { res.success(navigationService.getSettings()) } catch (e) { next(e) }
}

export async function updateSettings(req, res, next) {
  try { res.success(navigationService.updateSettings(req.user.id, req.body)) } catch (e) { next(e) }
}
