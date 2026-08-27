import { request } from '../../api/request.js'

export function listAlbums() { return request('GET', '/api/albums') }
export function getAlbum(id) { return request('GET', `/api/albums/${id}`) }
export function albumPhotos(id, offset, limit) { return request('GET', `/api/albums/${id}/photos?offset=${offset}&limit=${limit}`) }
export function createAlbum(data) { return request('POST', '/api/albums', data) }
export function addPhoto(id, data) { return request('POST', `/api/albums/${id}/photos`, data) }
export function updateAlbum(id, data) { return request('PUT', `/api/albums/${id}`, data) }
export function setCover(id, data) { return request('PUT', `/api/albums/${id}/cover`, data) }
export function updatePhotoCaption(id, photoId, caption) { return request('PUT', `/api/albums/${id}/photos/${photoId}`, { caption }) }
export function removeAlbum(id) { return request('DELETE', `/api/albums/${id}`) }
export function removePhoto(id, photoId) { return request('DELETE', `/api/albums/${id}/photos/${photoId}`) }
