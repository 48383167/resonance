// DeepSeek 连接配置：密钥只允许来自服务端环境变量，禁止传入客户端构建产物。
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
export const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
// 当前官方 Flash 模型标识。新版本发布时可仅修改环境变量，无需改业务代码。
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
const configuredTimeout = Number(process.env.DEEPSEEK_TIMEOUT_MS || 45000)
export const DEEPSEEK_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : 45000

export function isDeepSeekConfigured() {
  return Boolean(DEEPSEEK_API_KEY)
}
