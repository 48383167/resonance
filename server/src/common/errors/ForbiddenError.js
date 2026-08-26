import { AppError } from './AppError.js'

export class ForbiddenError extends AppError {
  constructor(message = '无权访问') {
    super(message, 403, 'FORBIDDEN')
  }
}
