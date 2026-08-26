import { AppError } from './AppError.js'

export class UnauthorizedError extends AppError {
  constructor(message = '未登录或登录已过期') {
    super(message, 401, 'UNAUTHORIZED')
  }
}
