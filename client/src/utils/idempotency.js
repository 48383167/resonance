// 为一次逻辑写入生成可安全放入 HTTP header 的唯一标识。
export function generateIdempotencyKey() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // 极老旧浏览器没有 Web Crypto 时，仍组合时间、计数器和高精度随机值。
  const now = Date.now().toString(36)
  const random = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  return `${now}-${random}-${idempotencyCounter++}`
}

let idempotencyCounter = 0
