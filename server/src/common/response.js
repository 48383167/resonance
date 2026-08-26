// 统一响应封装：为 res 挂载 success / fail 助手，保持 { ok, data, error } 契约
// error 统一为 { code, message } 对象形态；code 机器可读、message 人类可读。
// 迁移期：旧路由仍可返回字符串 error，前端需兼容两种形态；新代码一律走本助手。
export function setupResponse(app) {
  app.use((req, res, next) => {
    res.success = function (data) {
      return res.json({ ok: true, data })
    }

    res.fail = function (error) {
      const err = error instanceof Error ? error : new Error(String(error ?? '服务器内部错误'))
      const status = err.status || 500
      const code = err.code || 'INTERNAL_ERROR'
      return res.status(status).json({
        ok: false,
        error: { code, message: err.message },
      })
    }

    next()
  })
}
