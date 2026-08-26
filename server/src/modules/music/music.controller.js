import * as musicService from './music.service.js'

// 曲库「软错误」保持 { ok:false, error:string } 契约（前端 music 视图按此解析）
export async function getTracks(req, res, next) {
  try {
    const result = await musicService.getTracks()
    if (result.error) return res.json({ ok: false, error: result.error })
    res.success(result.tracks)
  } catch (e) {
    res.json({ ok: false, error: `获取音乐失败：${e.message}` })
  }
}
