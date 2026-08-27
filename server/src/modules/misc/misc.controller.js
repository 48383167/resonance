import * as miscService from './misc.service.js'

export function dashboard(req, res) {
  res.success(miscService.getDashboard(req.user))
}

export function treeState(req, res) {
  res.success(miscService.getTreeState())
}

export function updateProfile(req, res) {
  res.success(miscService.updateProfile(req.user.id, req.body))
}
