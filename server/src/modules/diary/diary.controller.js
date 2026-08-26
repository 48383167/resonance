import * as diaryService from './diary.service.js'

export async function list(req, res, next) {
  try {
    res.success(diaryService.getList())
  } catch (error) {
    next(error)
  }
}

export async function calendar(req, res, next) {
  try {
    res.success(diaryService.getCalendar(req.query))
  } catch (error) {
    next(error)
  }
}

export async function detail(req, res, next) {
  try {
    res.success(diaryService.getDetail(req.params.id))
  } catch (error) {
    next(error)
  }
}

export async function create(req, res, next) {
  try {
    res.success(diaryService.create(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function setVisibility(req, res, next) {
  try {
    res.success(diaryService.setVisibility(req.user.id, req.params.id, req.body?.isPublic))
  } catch (error) {
    next(error)
  }
}

export async function remove(req, res, next) {
  try {
    res.success(diaryService.remove(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
}
