// 列表分页参数：offset >= 0，1 <= limit <= 50；未传 limit/offset 视为旧的全量模式（返回数组）
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50

export function parsePage(query = {}) {
  const paginated = query.limit !== undefined || query.offset !== undefined
  const offset = Math.max(0, Number(query.offset) || 0)
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE))
  return { offset, limit, paginated }
}
