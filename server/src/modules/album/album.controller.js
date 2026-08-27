import * as albumService from './album.service.js'

export async function list(req, res, next) {
  try { res.success(albumService.list()) } catch (e) { next(e) }
}

export async function detail(req, res, next) {
  try { res.success(albumService.getDetail(req.params.id)) } catch (e) { next(e) }
}

export async function create(req, res, next) {
  try { res.success(albumService.create(req.body)) } catch (e) { next(e) }
}

export async function update(req, res, next) {
  try { res.success(albumService.update(req.params.id, req.body)) } catch (e) { next(e) }
}

export async function remove(req, res, next) {
  try { res.success(albumService.remove(req.user.id, req.params.id)) } catch (e) { next(e) }
}

export async function addPhoto(req, res, next) {
  try { res.success(albumService.addPhoto(req.params.id, req.body)) } catch (e) { next(e) }
}

export async function removePhoto(req, res, next) {
  try { res.success(albumService.removePhoto(req.user.id, req.params.photoId)) } catch (e) { next(e) }
}

export async function setCover(req, res, next) {
  try { res.success(albumService.setCover(req.params.id, req.body)) } catch (e) { next(e) }
}

export async function photosPage(req, res, next) {
  try { res.success(albumService.photosPage(req.params.id, req.query)) } catch (e) { next(e) }
}

export async function updatePhotoCaption(req, res, next) {
  try { res.success(albumService.updatePhotoCaption(req.params.photoId, req.body)) } catch (e) { next(e) }
}
