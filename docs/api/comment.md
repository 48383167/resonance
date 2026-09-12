# 评论 API

> 评论用于双人空间内对「日记」与「恋爱瞬间」的互动。
> 支持一级回复（回复的回复会扁平化到同一顶层评论，仅记录被回复人用于 @显示）。
> 评论必须由当前登录用户在其所属情侣空间内创建。

## 数据模型

`server/src/config/database.js` 建表段定义（老库由 `ensureColumns` 幂等补列，重启后自动生效）：

```sql
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,       -- 'entry'（日记） | 'moment'（恋爱瞬间）
    target_id TEXT NOT NULL,         -- 目标资源 ID
    user_id TEXT NOT NULL,           -- 评论作者
    content TEXT NOT NULL,           -- 评论正文（1~500 字）
    parent_id TEXT,                  -- 所属顶层评论 ID（NULL = 顶层）
    reply_to_user_id TEXT,           -- 被回复人（回复的回复时用于 @显示）
    reply_to_comment_id TEXT,        -- 直接回复的目标评论 ID（用于引用标注/跳转）
    deleted_at TEXT,                 -- 墓碑时间（NULL = 正常）
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
```

### 回复模型（单层）

- 顶层评论：`parent_id = NULL`。
- 回复顶层评论：`parent_id = 顶层评论 ID`，`reply_to_user_id = 顶层作者`，`reply_to_comment_id = 顶层评论 ID`。
- 回复某条回复：`parent_id` 仍为**同一顶层评论 ID**（扁平化），`reply_to_user_id = 被回复回复的作者`，`reply_to_comment_id = 被回复回复的 ID`；前端据此显示引用摘要（`↩ 昵称：内容…`），点击可跳转到被回复评论并高亮。
- `reply_to_comment_id` 是精确回复目标；同一作者多条评论时也能区分具体回复的是哪一条。
- 已墓碑化的评论不可再被回复。

### 删除策略（墓碑 / 物理删除）

- 评论**没有下级回复、也未被其他回复引用**时：物理删除，列表中直接消失。
- 评论**有下级回复或被其他回复引用**时：墓碑化（`content` 清空、`deleted_at` 记录时间），行保留以承载回复/引用；前端显示「该评论已删除」，引用它的回复显示「昵称：该评论已删除」。

## 评论对象（响应结构）

```json
{
  "id": "cm_xxxxxxxx",
  "target_type": "entry",
  "target_id": "e_xxxxxxxx",
  "user_id": "u_xxxxxxxx",
  "content": "好甜呀",
  "parent_id": null,
  "reply_to_user_id": null,
  "reply_to_comment_id": null,
  "deleted_at": null,
  "created_at": "2026-09-12T08:00:00.000Z",
  "author": {
    "id": "u_xxxxxxxx",
    "username": "alice",
    "nickname": "小艾",
    "avatar_url": "/media/..."
  }
}
```

- `author` 为公开用户字段（与恋爱瞬间的 `author` 结构一致，不含密码哈希）。
- 墓碑化的评论：`content` 为空字符串、`deleted_at` 有值。
- 列表返回**平铺**数组（按创建时间升序，含墓碑与回复）；前端按 `parent_id` 分组渲染：顶层升序，回复升序挂在对应顶层下（显示为两层）。
- 客户端用 `reply_to_comment_id` 在列表内定位被回复评论，渲染引用摘要；`reply_to_user_id` 作为旧数据回退（显示「回复 @某人」）。

## API 契约

所有接口均需登录（`Authorization: Bearer <token>`）。
`POST /api/comments` 需携带 `Idempotency-Key` 请求头（与现有创建类接口一致）。

### 1. GET /api/comments?targetType=entry&targetId=e_xxx

获取指定资源的评论列表（平铺，含回复与墓碑），按创建时间升序（最早在前）。

| 位置 | 字段 | 类型 | 说明 |
|---|---|---|---|
| query | `targetType` | string | `entry` 或 `moment` |
| query | `targetId` | string | 目标资源 ID |

成功响应（`200`）：

```json
{
  "ok": true,
  "data": [ { "id": "cm_xxxxxxxx", "content": "好甜呀", "parent_id": null, "author": { "nickname": "小艾" } } ]
}
```

失败响应（`error` 为对象形态）：

- `targetType` 非法：`400` `{ code: "BAD_REQUEST", message: "targetType 必须是 entry 或 moment" }`
- `targetId` 缺失：`400` `{ code: "BAD_REQUEST", message: "targetId 不能为空" }`
- 目标不存在：`404` `{ code: "NOT_FOUND", message: "日记不存在" }` / `{ "...", message: "瞬间不存在" }`
- 目标不属于当前用户的情侣空间：`403` `{ code: "FORBIDDEN", message: "无权访问该情侣空间的数据" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

### 2. POST /api/comments

请求体（`parentId` 可选，缺省/空串表示顶层评论）：

```json
{
  "targetType": "moment",
  "targetId": "m_xxxxxxxx",
  "content": "这里我也去过！",
  "parentId": "cm_xxxxxxxx"
}
```

成功响应（`200`）：`{ "ok": true, "data": 评论对象 }`（回复的 `parent_id` 已扁平化为顶层 ID）。

失败响应：

- `content` 为空或全空白：`400` `{ code: "BAD_REQUEST", message: "评论内容不能为空" }`
- `content` 超过 500 字：`400` `{ code: "BAD_REQUEST", message: "评论最多 500 字" }`
- `parentId` 缺失/空白：`400` `{ code: "BAD_REQUEST", message: "parentId 不能为空" }`
- 父评论不存在：`404` `{ code: "NOT_FOUND", message: "评论不存在" }`
- 父评论不属于该目标内容：`400` `{ code: "BAD_REQUEST", message: "parentId 与目标内容不匹配" }`
- 父评论已删除（墓碑）：`400` `{ code: "BAD_REQUEST", message: "该评论已删除，无法回复" }`
- 缺少 `Idempotency-Key`：`400` `{ code: "IDEMPOTENCY_KEY_REQUIRED", message: "缺少 Idempotency-Key 请求头" }`
- 目标不存在 / 无权限 / 未登录：同列表接口

### 3. DELETE /api/comments/:id

仅评论作者本人可删除（情侣另一方也不可删除）。

成功响应（`200`）：

```json
{ "ok": true, "data": { "id": "cm_xxxxxxxx", "tombstoned": true } }
```

- `tombstoned = true`：该评论有回复或被引用，已墓碑化（正文清空，回复保留）。
- `tombstoned = false`：已物理删除。
- 重复删除已墓碑评论幂等返回 `{ id, tombstoned: true }`，不重复广播。

失败响应：

- 评论不存在：`404` `{ code: "NOT_FOUND", message: "评论不存在" }`
- 非作者：`403` `{ code: "FORBIDDEN", message: "只能删除自己的评论" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

## Socket.IO 事件

向情侣空间房间 `couple:{pairCode}` 广播（与现有业务事件一致）。

| 事件 | 负载 | 触发时机 |
|---|---|---|
| `comment:created` | 评论对象（结构同 POST 响应） | 评论 / 回复创建成功后 |
| `comment:deleted` | `{ "id": "cm_xxx", "targetType": "entry", "targetId": "e_xxx", "tombstoned": false }` | 评论删除成功后 |

- 客户端按 `target_type` + `target_id` 过滤后再更新对应评论区。
- 创建者本人也会收到 `comment:created`，前端需按评论 `id` 去重。
- `comment:deleted` 按 `tombstoned` 区分处理：`true` → 本地标记墓碑（正文清空 + `deleted_at`），`false` → 从列表移除。
- 级联删除（日记 / 瞬间被删除时清理其全部评论）不单独广播评论事件，由对应资源的 `diary:deleted` / `moment:deleted` 事件负责刷新。

## 权限规则

- 读取 / 创建评论前，先定位目标资源并校验其作者与当前用户同属一个情侣空间（`coupleService.assertSamePair`）；跨空间一律 `403`。
- 回复的父评论必须存在于同一目标（同一日记 / 瞬间），否则 `404` / `400`。
- 删除仅允许评论作者本人。
- 日记目标归属按正文作者（`entry_contents.user_id`）判定；瞬间目标归属按作者（`moments.user_id`）判定。
- 评论不进入分享链接与观测台公开内容，公开链路不下发评论。
- 日记 / 瞬间被删除时，其评论（含回复）级联清理，不产生孤儿数据。
