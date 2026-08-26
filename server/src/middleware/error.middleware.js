import { AppError } from '../common/errors/AppError.js'

// 统一错误处理：所有 throw 的错误最终汇聚于此，转为 { ok:false, error:{code,message} }
// 必须挂载在所有路由之后（Express 通过 4 参签名识别错误中间件）。
export function errorHandler(err, req, res, next) {
  // 已知业务异常按原样返回；其余为意外错误，记录日志避免静默吞掉 bug
  if (!(err instanceof AppError)) {
    console.error('[unhandled error]', err)
  }
  return res.fail(err)
}
