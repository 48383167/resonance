import nodemailer from 'nodemailer'
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  isMailerConfigured,
} from '../../config/mailer.js'

// SMTP 发送通道：懒加载 transporter；正文同时提供纯文本与轻量 HTML。
let transporter = null

function getTransporter() {
  if (!isMailerConfigured()) throw new Error('SMTP 未配置')
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  }
  return transporter
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}

function toHtml(text) {
  const body = escapeHtml(text).replace(/\n/g, '<br>')
  return `<div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;font-size:15px;line-height:1.9;color:#33332e;max-width:520px">${body}</div>`
}

export async function sendMail({ to, subject, text }) {
  const info = await getTransporter().sendMail({
    from: `共鸣 <${SMTP_FROM}>`,
    to,
    subject,
    text,
    html: toHtml(text),
  })
  return { messageId: info.messageId }
}
