import { AppError } from './AppError.js'

export class BadRequestError extends AppError {
  constructor(message = '请求参数错误') {
    super(message, 400, 'BAD_REQUEST')
  }
}
