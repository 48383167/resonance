import * as authService from './auth.service.js'

export async function state(req, res, next) {
  try {
    res.success(authService.getState())
  } catch (error) {
    next(error)
  }
}

export async function register(req, res, next) {
  try {
    res.success(authService.register(req.body))
  } catch (error) {
    next(error)
  }
}

export async function login(req, res, next) {
  try {
    res.success(authService.login(req.body))
  } catch (error) {
    next(error)
  }
}

export async function me(req, res, next) {
  try {
    res.success(authService.getMe(req.user))
  } catch (error) {
    next(error)
  }
}

export async function changePassword(req, res, next) {
  try {
    res.success(authService.changePassword(req.user, req.body))
  } catch (error) {
    next(error)
  }
}
