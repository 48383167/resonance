import * as commentService from './comment.service.js'

export async function list(req, res, next) {
  try {
    res.success(commentService.list(req.user.id, req.query))
  } catch (error) {
    next(error)
  }
}

export async function create(req, res, next) {
  try {
    res.success(commentService.create(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function remove(req, res, next) {
  try {
    res.success(commentService.remove(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
}
