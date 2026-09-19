# 心愿（Wish）契约

> 心愿清单：想一起做的事，三态看板流转（待办 / 进行中 / 已完成）。
> 开始与完成时间支持**补记与修正**：流转时可选择实际发生的日期（默认今天，不允许未来），
> 编辑页可随时修正或清空。

## 数据模型

### wish_items

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | `w_` + uuid 前 12 位 |
| proposer_id | TEXT | 提出人 |
| title | TEXT | 心愿内容，必填 |
| description | TEXT | 补充说明，可空 |
| category | TEXT | `travel` 旅行 / `food` 美食 / `gift` 礼物 / `life` 生活 / `other` 其他 |
| priority | INTEGER | 0 普通 / 1 重要 / 2 非常想 |
| status | TEXT | `todo` 待办 / `doing` 进行中 / `done` 已完成 |
| started_at | TEXT | 开始日期 `YYYY-MM-DD`（旧数据可能为 ISO 时间戳） |
| completed_at | TEXT | 完成日期 `YYYY-MM-DD`（旧数据可能为 ISO 时间戳） |
| created_at | TEXT | 提出时间 ISO8601 UTC |

时间节点语义：

- 进入 `doing`：`started_at` = 所选日期（缺省今天）
- 进入 `done`：`completed_at` = 所选日期（缺省今天）；已记录的开始日期保留
- 回退（done → doing → todo）：离开阶段的时间戳清空
- 编辑页显式提交 `startedAt` / `completedAt`（可为 `null` 清空）用于补记/修正

## API 契约

以下接口均需登录（`Authorization: Bearer <token>`）。

### 1. GET /api/wishes

返回全部心愿（含 `proposer` 用户对象），按 `priority DESC, created_at ASC` 排序。

### 2. POST /api/wishes（需 `Idempotency-Key`）

```json
{
  "title": "去看海",
  "description": "可留空",
  "category": "travel",
  "priority": 2,
  "startedAt": "2026-09-10",
  "completedAt": null
}
```

- `title` 必填非空；`category` / `priority` 原样透传
- `startedAt` / `completedAt` 可空；格式必须 `YYYY-MM-DD` 且不得晚于今天，否则 400

### 3. GET /api/wishes/:id

单条详情；不存在 → 404 `NOT_FOUND`「心愿不存在」。

### 4. PUT /api/wishes/:id/status

```json
{ "status": "done", "date": "2026-09-15" }
```

- 快捷看板流转 `todo → doing → done`（退回同样走此接口）
- `date` 可选（`YYYY-MM-DD`，不得晚于今天）：补记本次流转的真实日期；缺省为今天
- 退回上一阶段时忽略 `date` 并清空对应时间戳

### 5. PUT /api/wishes/:id

编辑更新（字段白名单，可部分提交）：

```json
{ "title": "…", "description": "…", "category": "food", "priority": 1, "startedAt": "2026-09-10", "completedAt": null }
```

- `startedAt` / `completedAt`：`null` 清空；`YYYY-MM-DD` 写入；未来日期 → 400
- `status` 也可提交（与 `PUT /:id/status` 等效，日期规则相同）

### 6. DELETE /api/wishes/:id

删除心愿（心愿不参与置顶）。无 socket 事件（与其他心愿变更一致）。

## 错误码

| code | HTTP | 含义 |
|---|---|---|
| `NOT_FOUND` | 404 | 心愿不存在 |
| `BAD_REQUEST` | 400 | 字段校验失败（空标题 / 状态非法 / 日期格式非法或选未来） |

## 前端路由

| 路径 | name | 说明 |
|---|---|---|
| `/wishes` | `wishes` | 三态看板（流转时弹日期选择，默认今天） |
| `/wishes/new` | `wish-new` | 许愿（可直接补记开始/完成日期） |
| `/wishes/:id` | `wish-read` | 详情（流转同样弹日期） |
| `/wishes/:id/edit` | `wish-edit` | 编辑（含时间补记/修正，可清空） |
