import { Router } from 'express'
import { auth, badRequest, notFound, forbidden } from '../middleware.js'
import { createLetter, listLetters, getLetter, markLetterRead, updateLetter, deleteLetter } from '../db.js'

const router = Router()
router.use(auth)

router.post('/', (req, res) => {
  const { title, content, isSecret } = req.body || {}
  if (!content || !String(content).trim()) return badRequest(res, '信的内容不能为空')
  res.json({ ok: true, data: createLetter({ senderId: req.user.id, title, content, isSecret }) })
})

router.get('/', (req, res) => {
  res.json({ ok: true, data: listLetters() })
})

// 查看即标记已读（除自己外）
router.get('/:id', (req, res) => {
  const letter = getLetter(req.params.id)
  if (!letter) return notFound(res, '信件不存在')
  if (letter.sender_id !== req.user.id) markLetterRead(letter.id)
  res.json({ ok: true, data: getLetter(letter.id) })
})

// 编辑（仅写信人本人）
router.put('/:id', (req, res) => {
  const letter = getLetter(req.params.id)
  if (!letter) return notFound(res, '信件不存在')
  if (letter.sender_id !== req.user.id) return forbidden(res, '只能编辑自己写的情书')
  const { title, content, isSecret } = req.body || {}
  if (content != null && !String(content).trim()) return badRequest(res, '信的内容不能为空')
  res.json({ ok: true, data: updateLetter(letter.id, { title, content, isSecret }) })
})

router.delete('/:id', (req, res) => {
  deleteLetter(req.params.id)
  res.json({ ok: true, data: null })
})

export default router
