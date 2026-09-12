# 情感陪伴助手接口契约

## 目标与范围

情感陪伴助手是**当前登录用户私有**的文字咨询空间，仅用于情绪梳理、亲密关系沟通与自我觉察。

- 对话不属于 Couple 共享资源；伴侣不可查看、不可枚举、不可通过 ID 访问。
- 不自动读取日记、情书、瞬间、照片或伴侣资料；V1 仅将用户主动输入的对话内容发送给模型。
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

## 路由

### `GET /api/companion/consent`

需登录。返回当前用户是否已同意第三方模型处理。

```json
{ "ok": true, "data": { "consented": false, "consentedAt": null } }
```

### `PUT /api/companion/consent`

需登录。请求体：`{ "accepted": true }`。

撤回同意用 `accepted: false`；撤回后无法发送新消息，但已保存的本地对话仍可由本人删除。

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

前置条件：用户已经同意第三方处理。服务端仅传递本会话最近 10 条消息与本次输入给 DeepSeek；不会读取任何业务资源。

成功返回：

```json
{
  "userMessage": { "id": "am_...", "role": "user", "content": "...", "createdAt": "..." },
  "assistantMessage": { "id": "am_...", "role": "assistant", "content": "...", "createdAt": "..." },
  "remainingToday": 99
}
```

已识别的即时危机文本由本地安全回复处理，不发送给第三方模型。

### `DELETE /api/companion/conversations/:id`

需登录。仅会话拥有者可删除；会话与全部消息在本地数据库中一并物理删除。成功返回 `null`。

## 错误码

| Code | HTTP | 含义 |
| --- | --- | --- |
| `COMPANION_CONSENT_REQUIRED` | 403 | 尚未同意第三方模型处理 |
| `COMPANION_CONVERSATION_NOT_FOUND` | 404 | 会话不存在或不属于当前用户 |
| `COMPANION_RATE_LIMITED` | 429 | 已超过每用户每日 100 次正常模型咨询额度 |
| `AI_NOT_CONFIGURED` | 503 | 服务端未配置 `DEEPSEEK_API_KEY` |
| `AI_UNAVAILABLE` | 503 | 模型供应商暂不可用或超时 |
| `AI_RESPONSE_INVALID` | 502 | 模型返回不可用内容 |

## 运行配置

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
# 可选，默认 https://api.deepseek.com
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

密钥仅保存在服务端环境变量中，绝不下发给浏览器。`DEEPSEEK_MODEL` 可在官方发布新模型标识时替换；默认值使用当前官方 Flash 标识。
