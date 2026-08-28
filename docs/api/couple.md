# 情侣空间（Couple）契约

> 相识日期：两人可手动设置「相识日」，首页、分享页、时间线据此计算天数。
> 未手动设置时，回退为在 App 内完成配对的时间（`paired_at`）。

## 数据模型

`users` 新增一列（无独立 couple 表，双人空间成员共享同一 `pair_code`，两人行同步更新）：

```sql
first_meet_at TEXT  -- 相识日期 YYYY-MM-DD，NULL = 未手动设置
```

- 建表与老库补列（`ensureColumns`）均覆盖，迁移幂等。
- 设置时按 `pair_code` 同时更新两位成员的行。

## API 契约

### 1. PUT /api/couple/first-meet（需登录，需已配对）

设置相识日期。双方任何一方都可以修改，修改实时同步给对方（Socket 广播）。

请求参数：

| 位置 | 字段 | 类型 | 说明 |
|---|---|---|---|
| body | `date` | string | 相识日期 `YYYY-MM-DD`，有效日期，不得晚于今天 |

请求体：

```json
{ "date": "2023-05-20" }
```

成功响应（`200`）：

```json
{
  "ok": true,
  "data": {
    "firstMeetAt": "2023-05-20",
    "daysTogether": 1196
  }
}
```

失败响应（error 为对象形态）：

- `date` 缺失：`400` `{ code: "BAD_REQUEST", message: "请选择相识日期" }`
- 格式非 `YYYY-MM-DD`：`400` `{ code: "BAD_REQUEST", message: "相识日期格式应为 YYYY-MM-DD" }`
- 无效日期（如 2023-02-30）：`400` `{ code: "BAD_REQUEST", message: "相识日期无效" }`
- 晚于今天：`400` `{ code: "BAD_REQUEST", message: "相识日期不能晚于今天" }`
- 尚未配对：`403` `{ code: "FORBIDDEN", message: "尚未配对，无法设置相识日期" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

### 2. GET /api/dashboard（需登录）

响应新增字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `firstMeetAt` | string \| null | 手动设置的相识日期，未设置为 `null` |
| `daysTogether` | number | 相识天数：优先按 `firstMeetAt` 计算，未设置时回退 `paired_at` |

### 3. GET /api/couple（需登录）

响应新增字段：`firstMeetAt`（string | null）。

## Socket 事件

| 事件 | 房间 | 载荷 |
|---|---|---|
| `couple:updated` | `couple:{pairCode}` | `{ firstMeetAt, daysTogether }` |

设置相识日期后广播，伴侣端首页实时刷新。

## 关联计算规则

- `daysTogether`：`floor((今天 - 起始日) / 86400000)`，起始日 = `first_meet_at` ?? `paired_at`。
- 时间线 `pairStart`（「相识第 X 天」锚点）与观测台分享页天数同样优先 `first_meet_at`。
- 纪念日模块（`anniversaries`）独立管理，设置相识日期不会自动创建「初遇」纪念日。
