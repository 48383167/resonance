import * as shareService from './share.service.js'

export async function createShare(req, res, next) {
  try { res.success(shareService.createShare(req.body)) } catch (e) { next(e) }
}

export async function getCurrent(req, res, next) {
  try { res.success(shareService.getCurrent()) } catch (e) { next(e) }
}

export async function updateCurrent(req, res, next) {
  try { res.success(shareService.updateCurrent(req.body)) } catch (e) { next(e) }
}

export async function disableShare(req, res, next) {
  try { res.success(shareService.disableShare()) } catch (e) { next(e) }
}
