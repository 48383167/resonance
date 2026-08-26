// 业务异常基类：message 人类可读，status 为 HTTP 状态码，code 机器可读
export class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.code = code
  }
}
