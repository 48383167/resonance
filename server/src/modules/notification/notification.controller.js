import * as notificationService from './notification.service.js'

export async function getMail(req, res, next) {
  try { res.success(notificationService.getMailSettings(req.user.id)) } catch (e) { next(e) }
}

export async function updateMail(req, res, next) {
  try { res.success(notificationService.updateMailSettings(req.user.id, req.body)) } catch (e) { next(e) }
}

export async function sendTest(req, res, next) {
  try { res.success(await notificationService.sendTestMail(req.user.id)) } catch (e) { next(e) }
}

export async function preview(req, res, next) {
  try { res.success(await notificationService.preview(req.user.id, req.query.type)) } catch (e) { next(e) }
}

export async function run(req, res, next) {
  try { res.success(await notificationService.runReminders()) } catch (e) { next(e) }
}
