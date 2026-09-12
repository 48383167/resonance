import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { ForbiddenError } from '../../common/errors/ForbiddenError.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'
import * as coupleService from '../couple/couple.service.js'
import * as diaryRepository from '../diary/diary.repository.js'
import * as momentRepository from '../moment/moment.repository.js'
import { emitCommentCreated, emitCommentDeleted } from '../../infrastructure/socket/comment.socket.js'
import * as commentRepository from './comment.repository.js'
import * as commentSchema from './comment.schema.js'

function coupleIdOf(userId) {
  return coupleService.getUserCouple(userId)?.pairCode || null
}

// 目标归属校验：资源必须存在，且作者与当前用户同属一个情侣空间
function assertTargetAccessible(userId, targetType, targetId) {
  if (targetType === 'entry') {
    const entry = diaryRepository.findById(targetId)
    if (!entry) throw new NotFoundError('日记不存在')
    const authorIds = diaryRepository.listContentUserIds(targetId)
    if (!authorIds.length) throw new NotFoundError('日记不存在')
    coupleService.assertSamePair(userId, authorIds[0])
    return
  }
  const moment = momentRepository.findById(targetId)
  if (!moment) throw new NotFoundError('瞬间不存在')
  coupleService.assertSamePair(userId, moment.user_id)
}

// 回复解析：仅一级回复。回复顶层评论时挂其 id；回复「回复」时扁平化到同一顶层，
// 并记录被回复人（@显示）与直接回复目标（引用标注/跳转）。已删除（墓碑）的评论不可回复。
function resolveReply(data) {
  if (!data.parentId) return { parentId: null, replyToUserId: null, replyToCommentId: null }
  const parent = commentRepository.findById(data.parentId)
  if (!parent) throw new NotFoundError('评论不存在')
  if (parent.target_type !== data.targetType || parent.target_id !== data.targetId) {
    throw new BadRequestError('parentId 与目标内容不匹配')
  }
  if (parent.deleted_at) throw new BadRequestError('该评论已删除，无法回复')
  return {
    parentId: parent.parent_id || parent.id,
    replyToUserId: parent.user_id,
    replyToCommentId: parent.id,
  }
}

export function list(userId, query) {
  const { targetType, targetId } = commentSchema.validateList(query)
  assertTargetAccessible(userId, targetType, targetId)
  return commentRepository.list(targetType, targetId)
}

export function create(userId, raw) {
  const data = commentSchema.validateCreate(raw)
  assertTargetAccessible(userId, data.targetType, data.targetId)
  const reply = resolveReply(data)
  const comment = commentRepository.create({ ...data, ...reply, userId })
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitCommentCreated(coupleId, comment)
  return comment
}

export function remove(userId, id) {
  const comment = commentRepository.findById(id)
  if (!comment) throw new NotFoundError('评论不存在')
  if (comment.user_id !== userId) throw new ForbiddenError('只能删除自己的评论')
  // 幂等：已墓碑化的评论不重复广播
  if (comment.deleted_at) return { id, tombstoned: true }

  // 有回复 → 墓碑化（保留对方的回复）；无回复 → 物理删除
  const tombstoned = commentRepository.hasChildren(id)
  if (tombstoned) commentRepository.tombstone(id)
  else commentRepository.remove(id)

  const coupleId = coupleIdOf(userId)
  if (coupleId) {
    emitCommentDeleted(coupleId, {
      id,
      targetType: comment.target_type,
      targetId: comment.target_id,
      tombstoned,
    })
  }
  return { id, tombstoned }
}

// 目标资源删除时的级联清理（不单独广播，资源自身的 deleted 事件负责前端刷新）
export function removeByTarget(targetType, targetId) {
  commentRepository.removeByTarget(targetType, targetId)
}
