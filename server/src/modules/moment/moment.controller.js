import * as momentService from './moment.service.js'

export async function list(req, res, next) {
  try {
    res.success(momentService.list(req.query))
  } catch (error) {
    next(error)
  }
}

export async function listMap(req, res, next) {
  try {
    res.success(momentService.listMap())
  } catch (error) {
    next(error)
  }
}

export async function detail(req, res, next) {
  try {
    res.success(momentService.getDetail(req.params.id))
  } catch (error) {
    next(error)
  }
}

export async function create(req, res, next) {
  try {
    res.success(momentService.create(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function update(req, res, next) {
  try {
    res.success(momentService.update(req.user.id, req.params.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function updateShareVisibility(req, res, next) {
  try {
    res.success(momentService.updateShareVisibility(req.user.id, req.params.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function remove(req, res, next) {
  try {
    res.success(momentService.remove(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
}
