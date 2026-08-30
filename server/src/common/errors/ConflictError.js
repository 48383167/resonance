import { AppError } from './AppError.js'

export class ConflictError extends AppError {
  constructor(message = '请求冲突', code = 'CONFLICT') {
    super(message, 409, code)
  }
}
