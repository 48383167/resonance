// 后端 API 通用封装：Bearer Token 鉴权；401 时自动登出回登录页
const token = () => localStorage.getItem('resonance.token') || ''

export async function request(method, url, body, isForm) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  if (token()) headers['Authorization'] = `Bearer ${token()}`
  const res = await fetch(url, {
    method,
    headers,
    cache: 'no-store',
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  if (res.status === 401 && !url.startsWith('/api/auth/') && !url.startsWith('/api/public/')) {
    localStorage.removeItem('resonance.token')
    if (location.pathname !== '/login' && location.pathname !== '/register') location.href = '/login'
  }
  const json = await res.json().catch(() => ({ ok: false, error: '服务器响应异常' }))
  if (!json.ok) {
    // 兼容迁移期两种 error 形态：旧路由字符串，新路由 { code, message }
    const err = json.error
    const msg = typeof err === 'string' ? err : (err && err.message) || `请求失败 (${res.status})`
    throw new Error(msg)
  }
  return json.data
}
