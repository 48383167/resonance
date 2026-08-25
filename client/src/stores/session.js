import { reactive } from 'vue'
import { api } from '../api'
import { authSocket, socketDisconnect } from '../socket'

// 全局会话：token 由 localStorage 持久化，会话内保存本人 / 伴侣 / 在线状态
export const session = reactive({
  userId: '',
  me: null,
  partner: null,
  partnerOnline: false,
  inviteCode: '', // 未配对时显示邀请码
})

export function isLoggedIn() {
  return Boolean(localStorage.getItem('resonance.token'))
}

export function setLogin({ token, me, partner }) {
  localStorage.setItem('resonance.token', token)
  session.userId = me.id
  session.me = me
  session.partner = partner
  authSocket(token)
}

export async function initSession() {
  const t = localStorage.getItem('resonance.token')
  if (!t) return
  try {
    const { me, partner, inviteCode } = await api.get('/api/auth/me')
    session.userId = me.id
    session.me = me
    session.partner = partner
    session.inviteCode = inviteCode || ''
    authSocket(t)
  } catch {
    logout()
  }
}

export function logout() {
  localStorage.removeItem('resonance.token')
  session.userId = ''
  session.me = null
  session.partner = null
  session.partnerOnline = false
  session.inviteCode = ''
  socketDisconnect()
}
