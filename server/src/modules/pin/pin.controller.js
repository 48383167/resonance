import * as pinService from './pin.service.js'

export async function setPin(req, res, next) {
  try { res.success(pinService.setPin(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function listGlobal(req, res, next) {
  try { res.success(pinService.listGlobal()) } catch (e) { next(e) }
}
