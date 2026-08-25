import { io } from 'socket.io-client'

// 登录后才连接；重连时自动重新认证
export const socket = io({ autoConnect: false })

socket.on('connect', () => {
  const t = localStorage.getItem('resonance.token')
  if (t) socket.emit('auth:join', { token: t })
})

export function authSocket(token) {
  if (!socket.connected) socket.connect()
  else socket.emit('auth:join', { token })
}

export function socketDisconnect() {
  if (socket.connected) socket.disconnect()
}
