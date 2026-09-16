// QQ 邮箱 SMTP 配置：授权码只允许来自服务端环境变量，禁止写入仓库或客户端。
// 在 QQ 邮箱「设置 → 账户 → POP3/SMTP服务」开启后生成授权码，不是登录密码。
export const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com'
export const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
export const SMTP_SECURE = String(process.env.SMTP_SECURE ?? 'true') !== 'false'
export const SMTP_USER = process.env.SMTP_USER || ''
export const SMTP_PASS = process.env.SMTP_PASS || ''
export const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

export function isMailerConfigured() {
  return Boolean(SMTP_USER && SMTP_PASS)
}
