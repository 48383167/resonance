// 情感陪伴的服务端运行参数。限额以“正常模型回复”为单位；本地危机安全回复不占额度。
const DEFAULT_DAILY_MODEL_REPLY_LIMIT = 100
const MAX_DAILY_MODEL_REPLY_LIMIT = 10_000

function readDailyModelReplyLimit(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAILY_MODEL_REPLY_LIMIT) {
    return DEFAULT_DAILY_MODEL_REPLY_LIMIT
  }
  return parsed
}

export const COMPANION_DAILY_MODEL_REPLY_LIMIT = readDailyModelReplyLimit(
  process.env.COMPANION_DAILY_MODEL_REPLY_LIMIT,
)
