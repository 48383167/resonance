# 创建接口幂等约定

以下已登录用户的创建接口必须携带 `Idempotency-Key` 请求头：

- `POST /api/entries/solo`
- `POST /api/moments`
- `POST /api/letters`
- `POST /api/albums`
- `POST /api/albums/:id/photos`
- `POST /api/wishes`
- `POST /api/capsules`
- `POST /api/anniversaries`
- `POST /api/share/create`

同一用户、同一路径、同一个 key：

- 首次成功后，后续相同请求直接重放首次响应，不会再次执行写入或发送 Socket 事件。
- 请求体不同返回 `409 IDEMPOTENCY_KEY_REUSE`。
- 首次请求仍在处理时返回 `409 IDEMPOTENCY_KEY_IN_PROGRESS`。
- 首次请求失败不会占用 key，修正请求后可以复用并重试。

客户端应在一次逻辑提交开始时生成 key，并在网络重试期间复用它；新的用户操作必须生成新的 key。服务端完成记录保留 24 小时。
