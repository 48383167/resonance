# 分享链接（Share）契约

> 分享链接用于将双人空间的部分内容以只读方式公开给访客。
> 每次仅存在一个有效分享链接；链接支持可选密码、有效期、浏览计数，
> 并可按内容范围（恋爱瞬间 / 公开日记 / 纪念日）控制对外可见类别。

## 数据模型

`share_tokens` 新增三列（建表与老库补列均覆盖，迁移幂等）：

```sql
include_moments       INTEGER NOT NULL DEFAULT 1  -- 1=分享恋爱瞬间，0=关闭
include_entries       INTEGER NOT NULL DEFAULT 1  -- 1=分享公开日记，0=关闭
include_anniversaries INTEGER NOT NULL DEFAULT 1  -- 1=分享纪念日，0=关闭
```

- 老库既有 `share_tokens` 行由 `ensureColumns` 自动补列，默认值为 `1`，
  保证既有分享行为不变（三类内容照旧可见）。

## 条目级可见性（show_in_share）

除「类别开关」外，恋爱瞬间与纪念日还支持**条目级**可见性：

```sql
moments.show_in_share       INTEGER NOT NULL DEFAULT 1  -- 1=该瞬间可进入分享，0=不分享
anniversaries.show_in_share INTEGER NOT NULL DEFAULT 1  -- 1=该纪念日可进入分享，0=不分享
```

- 建表（`CREATE TABLE`）与老库补列（`ensureColumns`）均覆盖，迁移幂等；老数据默认 `1`（可见）。
- 普通登录列表（`GET /api/moments`、`GET /api/anniversaries`）继续返回全部条目及
  `show_in_share` 字段，供设置页展示每条的状态；条目级过滤只发生在公开分享链路。
- 该字段与类别开关是 **AND** 关系：某条目要进入分享页，必须同时满足
  「类别开关开启」且「该条目 `show_in_share = 1`」。任一条件不满足，该条目都不会被公开接口下发。

## 内容范围开关

| 请求字段（camelCase）  | 数据库列（snake_case）  | 默认值 | 说明 |
|---|---|---|---|
| `includeMoments` | `include_moments` | `true` | 恋爱瞬间 |
| `includeEntries` | `include_entries` | `true` | 公开日记（`entries.is_public = 1`） |
| `includeAnniversaries` | `include_anniversaries` | `true` | 纪念日 |

三个开关均为 boolean，非 boolean 一律返回 `400`。

## API 契约

以下接口均需登录（`Authorization: Bearer <token>`）。

### 1. POST /api/share/create

创建当前分享链接（覆盖并停用旧的有效链接）。

请求体（三个开关均可省略，缺省均为 `true`）：

```json
{
  "expireDays": 30,
  "password": "",
  "includeMoments": true,
  "includeEntries": false,
  "includeAnniversaries": true
}
```

字段说明：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `expireDays` | number | `30` | 有效天数；`<= 0` 表示永久 |
| `password` | string | `''` | 访问密码，空串表示无需密码 |
| `includeMoments` | boolean | `true` | 是否分享恋爱瞬间 |
| `includeEntries` | boolean | `true` | 是否分享公开日记 |
| `includeAnniversaries` | boolean | `true` | 是否分享纪念日 |

成功响应（`200`）：

```json
{
  "ok": true,
  "data": {
    "token": "9f3a...16位",
    "shareUrl": "/share/9f3a...16位",
    "expiresAt": "2025-09-25T00:00:00.000Z",
    "viewCount": 0,
    "hasPassword": false,
    "includeMoments": true,
    "includeEntries": false,
    "includeAnniversaries": true
  }
}
```

失败响应（`error` 为对象形态）：

- 任一开关非 boolean：`400` `{ code: "BAD_REQUEST", message: "includeMoments 必须是布尔值" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

### 2. GET /api/share/current

查询当前有效分享链接。无有效分享时 `data` 为 `null`。

成功响应（`200`）：

```json
{
  "ok": true,
  "data": {
    "token": "9f3a...16位",
    "shareUrl": "/share/9f3a...16位",
    "expiresAt": "2025-09-25T00:00:00.000Z",
    "viewCount": 0,
    "hasPassword": false,
    "includeMoments": true,
    "includeEntries": false,
    "includeAnniversaries": true
  }
}
```

### 3. PATCH /api/share/current

更新当前有效分享链接的内容范围开关。

- 仅更新当前有效分享；无有效分享时返回 `404`。
- 缺省字段保持当前值（部分提交）；全量提交则按传入值保存。

请求体（示例：仅关闭公开日记）：

```json
{ "includeEntries": false }
```

成功响应（`200`，返回更新后的当前分享信息，结构与 GET 相同）：

```json
{
  "ok": true,
  "data": {
    "token": "9f3a...16位",
    "shareUrl": "/share/9f3a...16位",
    "expiresAt": "2025-09-25T00:00:00.000Z",
    "viewCount": 0,
    "hasPassword": false,
    "includeMoments": true,
    "includeEntries": false,
    "includeAnniversaries": true
  }
}
```

失败响应：

- 任一提交字段非 boolean：`400` `{ code: "BAD_REQUEST", message: "includeEntries 必须是布尔值" }`
- 当前无有效分享：`404` `{ code: "NOT_FOUND", message: "当前没有有效的分享链接" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

### 4. DELETE /api/share/current

停用当前分享链接。成功响应 `{ "ok": true, "data": null }`。

### 5. PATCH /api/moments/:id/share-visibility（需登录）

设置某个恋爱瞬间是否进入分享链接（条目级可见性）。

请求参数：

| 位置 | 字段 | 类型 | 说明 |
|---|---|---|---|
| path | `id` | string | 瞬间 ID |
| body | `showInShare` | boolean | 是否在分享链接中展示该瞬间 |

请求体：

```json
{ "showInShare": false }
```

成功响应（`200`，返回更新后的完整瞬间对象，含 `show_in_share` 与 photos/author）：

```json
{
  "ok": true,
  "data": {
    "id": "m_xxxxxxxx",
    "user_id": "u_xxxxxxxx",
    "content": "今天一起看了日落",
    "mood": "sweet",
    "location": "海边",
    "show_in_share": 0,
    "author": { "id": "u_xxxxxxxx", "nickname": "昵称" },
    "photos": []
  }
}
```

失败响应：

- `showInShare` 非布尔值：`400` `{ code: "BAD_REQUEST", message: "showInShare 必须为布尔值" }`
- 瞬间不存在：`404` `{ code: "NOT_FOUND", message: "瞬间不存在" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

### 6. PATCH /api/anniversaries/:id/share-visibility（需登录）

设置某个纪念日是否进入分享链接（条目级可见性）。

请求参数：

| 位置 | 字段 | 类型 | 说明 |
|---|---|---|---|
| path | `id` | string | 纪念日 ID |
| body | `showInShare` | boolean | 是否在分享链接中展示该纪念日 |

请求体：

```json
{ "showInShare": false }
```

成功响应（`200`，返回更新后的纪念日对象，含 `show_in_share` 与 daysUntil/daysSince/isToday 计算字段）：

```json
{
  "ok": true,
  "data": {
    "id": "ann_xxxxxxxx",
    "title": "在一起纪念日",
    "type": "together",
    "date": "2025-08-26",
    "description": "",
    "show_in_share": 0,
    "daysUntil": 0,
    "daysSince": 123,
    "isToday": true
  }
}
```

失败响应：

- `showInShare` 非布尔值：`400` `{ code: "BAD_REQUEST", message: "showInShare 必须为布尔值" }`
- 纪念日不存在：`404` `{ code: "NOT_FOUND", message: "纪念日不存在" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

### 7. GET /api/public/share/:token（无需登录）

访客按 token 只读访问分享内容。可选 `?password=` 查询参数。

响应结构不变，仍返回 `users`、`daysTogether`、`stats`、`moments`、`entries`、`anniversaries` 六个字段；
依据该 token 的三个开关，关闭的类别返回**空数组**，且不查询、不下发对应内容。

成功响应（`200`）：

```json
{
  "ok": true,
  "data": {
    "users": [{ "nickname": "昵称", "avatarUrl": "/media/..." }],
    "daysTogether": 123,
    "stats": {
      "moments": 0,
      "entries": 0,
      "anniversaries": 2,
      "photos": 0,
      "letters": 0,
      "unreadLetters": 0,
      "wishesTodo": 0,
      "wishesDoing": 0,
      "wishesDone": 0,
      "capsules": 0
    },
    "moments": [],
    "entries": [],
    "anniversaries": [
      { "id": "ann_xxxxxxxx", "title": "纪念日", "type": "custom", "date": "2025-08-26", "description": "" }
    ]
  }
}
```

访问过滤规则：

- `include_moments = 0` → `moments: []`，`stats.moments = 0`
- `include_entries = 0` → `entries: []`，`stats.entries = 0`
- `include_anniversaries = 0` → `anniversaries: []`，`stats.anniversaries = 0`
- 类别开关开启时，`moments` 只下发 `show_in_share = 1` 的瞬间，`anniversaries` 只下发 `show_in_share = 1` 的纪念日；
  条目级过滤在 repository 的 public list 中完成，不在 controller/前端过滤。
- `stats.moments / stats.entries / stats.anniversaries` 与实际下发数组长度一致；其余统计字段保留。

特殊状态（保持原 API 兼容）：

- token 不存在或已停用：`404` `{ ok: false, error: "分享链接不存在或已停用" }`
- 已过期：`410` `{ ok: false, error: "分享链接已过期" }`
- 需要密码：`401` `{ ok: false, error: "需要密码", needPassword: true }`

## 隐私与权限规则

- 创建 / 查询 / 更新 / 停用接口均需登录；仅更新当前有效分享。
- 公开访问只下发三类开关允许的内容；关闭的类别不会被查询或返回。
- `entries` 始终只包含 `is_public = 1` 的公开日记，私有日记永不进入分享链接。
- `moments` 与 `anniversaries` 在类别开关开启的基础上，进一步按条目级 `show_in_share = 1` 过滤；
  关闭条目（`show_in_share = 0`）不会通过公共接口下发，也不会计入 `stats` 对应数量。
- 条目级 `show_in_share` 与类别开关为 **AND** 关系，二者同时成立才对外可见。
- 密码校验、有效期校验、浏览计数（`view_count`）逻辑保持不变，且先于内容过滤执行。
- 媒体 URL 统一由文件表解析为 `/media/{path}`，不返回物理路径或文件 ID 之外的内部字段。
