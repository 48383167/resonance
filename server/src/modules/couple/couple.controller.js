import * as coupleService from './couple.service.js'

export async function getCouple(req, res, next) {
  try {
    res.success(coupleService.getUserCouple(req.user.id))
  } catch (error) {
    next(error)
  }
}
