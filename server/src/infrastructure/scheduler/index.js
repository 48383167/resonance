import * as notificationService from '../../modules/notification/notification.service.js'

// 定时提醒：启动后先检查一次（补发漏掉的窗口），之后每 6 小时轮询；
// 是否重复发送由 notification_logs 的 dedupe_key 决定，进程重启不会重复打扰。
const FIRST_CHECK_DELAY_MS = 20 * 1000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let started = false

export function startScheduler() {
  if (started) return
  started = true
  setTimeout(() => runCheck('启动检查'), FIRST_CHECK_DELAY_MS).unref()
  setInterval(() => runCheck('定时检查'), CHECK_INTERVAL_MS).unref()
}

async function runCheck(reason) {
  try {
    const result = await notificationService.runReminders()
    if (result.sent) console.log(`[notification] 已发送 ${result.sent} 封提醒邮件（${reason}）`)
  } catch (error) {
    console.error(`[notification] 提醒检查失败（${reason}）`, error)
  }
}
