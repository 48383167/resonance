import { BadRequestError } from '../../common/errors/BadRequestError.js'
import { localDateStr } from '../../common/utils/date.js'

// 相识日期：YYYY-MM-DD、有效日历日期、不得晚于今天
export function validateFirstMeet(body = {}) {
  const date = body?.date
  if (!date) throw new BadRequestError('请选择相识日期')
  const d = String(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new BadRequestError('相识日期格式应为 YYYY-MM-DD')
  const parsed = new Date(`${d}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) {
    throw new BadRequestError('相识日期无效')
  }
  if (d > localDateStr()) throw new BadRequestError('相识日期不能晚于今天')
  return d
}
