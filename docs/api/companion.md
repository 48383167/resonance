# 情感陪伴助手接口契约

## 目标与范围

情感陪伴助手是**当前登录用户私有**的文字咨询空间，仅用于情绪梳理、亲密关系沟通与自我觉察。

- 对话不属于 Couple 共享资源；伴侣不可查看、不可枚举、不可通过 ID 访问。
- 不自动读取日记、情书、瞬间、照片或伴侣资料；仅将用户主动输入的对话内容，以及其主动保存并启用的短记忆发送给模型。
- 不提供医疗、法律、财务、事实检索、编程等非情感咨询，也不代替心理治疗或紧急援助。
- 首次发送消息前，用户必须明确同意其输入会被发送给配置的第三方模型处理。

所有成功响应为 `{ "ok": true, "data": ... }`；失败响应为 `{ "ok": false, "error": { "code", "message" } }`。

## 数据对象

### Conversation

```json
{
  "id": "ac_...",
  "title": "新的倾诉",
  "createdAt": "2026-09-12T00:00:00.000Z",
  "updatedAt": "2026-09-12T00:00:00.000Z"
}
```

创建时标题默认为「新的倾诉」；用户发出第一条消息后由服务端自动命名（规则见「会话自动命名」），标题一旦生成不再自动变更。

### Message

```json
{
  "id": "am_...",
  "role": "user",
  "content": "我今天有点委屈",
  "createdAt": "2026-09-12T00:00:00.000Z"
}
```

`role` 仅为 `user` 或 `assistant`。响应中不返回模型的思考过程、供应商请求体或 API 密钥。

### Memory

```json
{
  "id": "cm_...",
  "content": "发生分歧时，我希望先被倾听，再讨论解决方案。",
  "enabled": true,
  "createdAt": "2026-09-12T00:00:00.000Z",
  "updatedAt": "2026-09-12T00:00:00.000Z"
}
```

记忆是当前用户私有、主动保存的简短相处偏好或背景，不从日记、情书、瞬间或聊天中自动提取。`enabled: true` 表示它可在后续**正常模型咨询**中作为背景；即时危机文本始终只走本地安全回复，不读取或发送记忆。

## 路由

### `GET /api/companion/consent`

需登录。返回当前用户是否已同意第三方模型处理。

```json
{ "ok": true, "data": { "consented": false, "consentedAt": null } }
```

### `PUT /api/companion/consent`

需登录。请求体：`{ "accepted": true }`。

撤回同意用 `accepted: false`；撤回后无法发送新消息，但已保存的本地对话仍可由本人删除。当前同意版本同时涵盖“主动输入的消息”和“主动保存且启用的个人记忆”这两类出站数据；此前版本的同意会要求用户重新确认。

### `GET /api/companion/memories`

需登录。返回当前用户的 `Memory[]`；伴侣无法查看或枚举。

### `POST /api/companion/memories`

需登录。请求体：`{ "content": "..." }`，去首尾空白后 1–160 字。创建即为启用状态，且请求须带 `Idempotency-Key`。

记忆仅保存到本地数据库；它会在用户已同意第三方处理并发送正常消息时随该次请求发送给模型。每位用户至多启用 8 条记忆。

### `PUT /api/companion/memories/:id`

需登录。请求体至少包含一个字段：`{ "content": "..." }` 或 `{ "enabled": false }`。`content` 仍为 1–160 字；重新启用时同样受最多 8 条启用记忆限制。仅拥有者可更新。

### `DELETE /api/companion/memories/:id`

需登录。仅拥有者可删除，成功返回 `null`。删除或停用会立刻阻止后续模型请求使用该记忆；已发送给第三方的历史请求无法撤回。

### `GET /api/companion/conversations`

需登录。按更新时间倒序返回当前用户的 `Conversation[]`。

### `POST /api/companion/conversations`

需登录。请求体可选：`{ "title": "新的倾诉" }`。标题最长 40 字。

创建成功返回 `Conversation`。请求须带 `Idempotency-Key`。

### `GET /api/companion/conversations/:id`

需登录。仅会话拥有者可读取，返回：

```json
{
  "conversation": { "id": "ac_...", "title": "新的倾诉", "createdAt": "...", "updatedAt": "..." },
  "messages": [{ "id": "am_...", "role": "user", "content": "...", "createdAt": "..." }]
}
```

非拥有者与不存在的会话均返回 `COMPANION_CONVERSATION_NOT_FOUND`，不泄露会话归属。

### `POST /api/companion/conversations/:id/messages`

需登录。请求体：`{ "content": "..." }`，去首尾空白后 1–2000 字。请求须带 `Idempotency-Key`。

前置条件：用户已经同意第三方处理。服务端仅传递本会话最近 10 条消息、本次输入，以及最多 8 条由当前用户主动保存且启用的短记忆给 DeepSeek；不会读取任何业务资源。

成功返回：

```json
{
  "userMessage": { "id": "am_...", "role": "user", "content": "...", "createdAt": "..." },
  "assistantMessage": { "id": "am_...", "role": "assistant", "content": "...", "createdAt": "..." },
  "conversation": { "id": "ac_...", "title": "和男朋友的争吵", "createdAt": "...", "updatedAt": "..." },
  "remainingToday": 99
}
```

已识别的即时危机文本由本地安全回复处理，不发送给第三方模型。

#### 会话自动命名

- 触发条件：会话标题仍为「新的倾诉」且用户发出**第一条消息**。标题生成后不再自动变更。
- 生成方式：与情感回复**并行**请求模型，只发送用户的第一句话（不携带历史消息、记忆或任何业务数据），不占用每日咨询额度；提示词要求不超过 12 字且无标点。
- 兜底：模型不可用、未配置、未及时返回或即时危机消息（本地安全回复路径）时，截取首条消息前 14 字作为标题；标题请求不会增加情感回复的等待时间。
- `conversation` 字段始终返回最新会话对象，前端据此更新列表标题，无需额外请求。
- 历史遗留的「新的倾诉」会话在服务启动时一次性用首条消息回填（不调用模型、不改变 `updatedAt`）。

### `DELETE /api/companion/conversations/:id`

需登录。仅会话拥有者可删除；会话与全部消息在本地数据库中一并物理删除。成功返回 `null`。

## 错误码

| Code | HTTP | 含义 |
| --- | --- | --- |
| `COMPANION_CONSENT_REQUIRED` | 403 | 尚未同意第三方模型处理 |
| `COMPANION_CONVERSATION_NOT_FOUND` | 404 | 会话不存在或不属于当前用户 |
| `COMPANION_MEMORY_NOT_FOUND` | 404 | 记忆不存在或不属于当前用户 |
| `COMPANION_ACTIVE_MEMORY_LIMIT` | 400 | 已达到 8 条启用记忆上限 |
| `COMPANION_RATE_LIMITED` | 429 | 已超过当前部署配置的每用户每日正常模型咨询额度 |
| `AI_NOT_CONFIGURED` | 503 | 服务端未配置 `DEEPSEEK_API_KEY` |
| `AI_UNAVAILABLE` | 503 | 模型供应商暂不可用或超时 |
| `AI_RESPONSE_INVALID` | 502 | 模型返回不可用内容 |

## 运行配置

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
# 可选，默认 https://api.deepseek.com
DEEPSEEK_BASE_URL=https://api.deepseek.com
# 可选，默认 100；范围 1–10000。按每用户、每个 UTC 自然日的正常模型回复计数。
# 即时危机文本走本地安全回复，不占用该额度。
COMPANION_DAILY_MODEL_REPLY_LIMIT=100
```

密钥仅保存在服务端环境变量中，绝不下发给浏览器。`DEEPSEEK_MODEL` 可在官方发布新模型标识时替换；默认值使用当前官方 Flash 标识。
