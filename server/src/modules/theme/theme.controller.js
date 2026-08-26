import * as themeService from './theme.service.js'

export async function getTheme(req, res, next) {
  try { res.success(themeService.getTheme(req.user.id)) } catch (e) { next(e) }
}

export async function updateTheme(req, res, next) {
  try { res.success(themeService.updateTheme(req.user.id, req.body)) } catch (e) { next(e) }
}
