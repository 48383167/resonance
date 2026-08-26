import { AppError } from './AppError.js'

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 'NOT_FOUND')
  }
}
