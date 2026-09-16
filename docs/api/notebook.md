# 小本本 API（关怀档案 · 规矩 · 置顶）

「小本本」= 关怀档案（忌口/过敏/例假/偏好/其他）+ 相处规矩（底线/约定/建议）+ 两级置顶。

- 所有接口均需登录（`Authorization: Bearer <token>`），数据为情侣双方共享。
- 响应统一 `{ "ok": true, "data": ... }` / `{ "ok": false, "error": { "code", "message" } }`。
- 创建类 `POST` 必须携带 `Idempotency-Key` 请求头（否则 400 `IDEMPOTENCY_KEY_REQUIRED`）。
- 日期字段一律 `YYYY-MM-DD`；时间戳字段一律 ISO8601 UTC。
- 时区约定：服务端只做纯日期运算（返回 `nextStart` 等原始数据），**倒计时/状态由前端用设备本地「今天」计算**。

## 数据模型

> 与性别的关系：`users.gender` 为 `''`（未设置）/ `male` / `female`，在「设置 → 个人资料」中可选填。
> 情侣必为一男一女：**一方填写后，另一方自动同步为相反性别**（`PUT /api/users/me` 时联动，并广播 `profile:updated`）。
> 性别确定后，**例假固定归女性一方，不需要手动选择对象**；预测汇总时早期记录的旧对象也会自动归并。

### care_items（关怀档案）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | `care_` + uuid 前 12 位 |
| author_id | TEXT | 录入人 |
| subject_id | TEXT | 档案对象（我 / Ta）；例假固定为女性成员 |
| category | TEXT | `diet` 忌口 / `allergy` 过敏 / `period` 例假 / `preference` 偏好 / `other` 其他 |
| title | TEXT | 1~80 字 |
| content | TEXT | ≤ 2000 字，可空 |
| severity | TEXT | 仅 `allergy`：`mild` 轻 / `moderate` 中 / `severe` 重 |
| start_date | TEXT | 仅 `period`：开始日 |
| end_date | TEXT | 仅 `period`：结束日，可空 |
| cycle_days | INTEGER | 仅 `period`：15~60，可空（预测回退值） |
| created_at / updated_at | TEXT | ISO8601 UTC |

### couple_rules（相处规矩）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | `rule_` + uuid 前 12 位 |
| author_id | TEXT | 提出人 |
| type | TEXT | `redline` 底线 / `rule` 约定 / `suggestion` 建议 |
| title | TEXT | 1~80 字 |
| content | TEXT | ≤ 2000 字，可空 |
| status | TEXT | `active` 生效中 / `archived` 已停用 |
| agreed_ids | TEXT | JSON 数组；作者创建时自动加入；同属两人 → `effective: true` |
| created_at / updated_at | TEXT | ISO8601 UTC |

### pinned_items（通用置顶）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | `pin_` + uuid 前 12 位 |
| target_type | TEXT | v1 仅支持 `care` / `rule`（预留扩展其他模块） |
| target_id | TEXT | 目标资源 ID |
| pin_scope | TEXT | `list` 列表置顶 / `global` 全站置顶 |
| pinned_by | TEXT | 操作人 |
| created_at / updated_at | TEXT | ISO8601 UTC |

`UNIQUE(target_type, target_id)`：一个内容只有一个置顶级别；删除目标时须同步清理置顶行。

## 关怀档案

### 列表

`GET /api/care/items?category=&subjectId=`

返回数组，按 `global 置顶 > list 置顶 > updated_at DESC` 排序。

```json
[
  {
    "id": "care_ab12cd34ef56",
    "author_id": "u_xxx",
    "subject_id": "u_yyy",
    "category": "allergy",
    "title": "芒果过敏",
    "content": "吃完嘴唇发痒",
    "severity": "severe",
    "start_date": null,
    "end_date": null,
    "cycle_days": null,
    "pin_scope": "global",
    "created_at": "2026-09-16T02:00:00.000Z",
    "updated_at": "2026-09-16T02:00:00.000Z",
    "author": { "id": "u_xxx", "nickname": "小艾", "avatar_url": "" },
    "subject": { "id": "u_yyy", "nickname": "小博", "avatar_url": "" }
  }
]
```

### 详情

`GET /api/care/items/:id` → 单条 careItem。

### 新建

`POST /api/care/items`（需 `Idempotency-Key`）

```json
{
  "category": "period",
  "title": "例假记录",
  "content": "第一天有点痛",
  "subjectId": "u_yyy",
  "startDate": "2026-09-01",
  "endDate": "2026-09-05",
  "cycleDays": 28
}
```

校验：

- `category` 必须为枚举值，否则 400 `INVALID_CARE_CATEGORY`
- `subjectId` 必须是我或伴侣，否则 400 `INVALID_CARE_SUBJECT`
  - `category = 'period'`：性别确定（存在唯一 `female`）时**忽略传入值，固定为女性成员**；性别未确定时按传入值 → 默认伴侣 → 自己
  - 其余分类：缺省为伴侣，未配对为自己；男方可为对方记录例假
- `period` 必须提供 `startDate`；`endDate` 若存在必须 ≥ `startDate`，否则 400 `INVALID_PERIOD_RANGE`
- `cycleDays` 若存在必须在 15~60，否则 400 `INVALID_CYCLE_DAYS`
- `severity` 仅 `allergy` 允许，枚举 `mild/moderate/severe`，否则 400 `INVALID_CARE_SEVERITY`
- `title` 去除空白后不能为空

### 修改 / 删除

`PUT /api/care/items/:id` 请求体同新建（字段可选，合并更新）；`DELETE /api/care/items/:id`。

不存在 → 404 `CARE_ITEM_NOT_FOUND`。

### 例假预测

`GET /api/care/period/summary`

```json
{
  "subjects": [
    {
      "subject": { "id": "u_yyy", "nickname": "小博", "avatar_url": "" },
      "latestStart": "2026-09-01",
      "latestEnd": "2026-09-05",
      "durationDays": 5,
      "avgCycle": 28,
      "cycleSource": "history",
      "variationDays": 2,
      "intervals": 3,
      "nextStart": "2026-09-29"
    }
  ]
}
```

- `cycleSource`：周期来源。`history` 按历史间隔智能推算 / `setting` 按记录里填写的 `cycle_days` / `default` 无数据回退 28 天。
- `variationDays`：历史周期的标准差（波动范围），可用于展示「预计日期 ±N 天」；不足 2 个区间时为 0。
- `intervals`：参与推算的区间数。
- 性别确定后 `subjects` 恒为一个条目：所有例假记录（含早期记录的旧对象）归并到该女性成员；性别未确定时按 `subject_id` 分组。

算法（智能推算，纯统计不依赖外部 AI）：

1. 取 `category = 'period'` 且有 `start_date` 的记录，按 `start_date` 升序、去掉重复日期；
   `start_date > end_date` 的脏数据忽略该条的 `end_date`。
2. 相邻开始日间隔只采用 15~60 天的值，取最近 6 个区间。
3. 区间数 ≥ 3 时用中位数剔除偏离 > 7 天的异常区间（一次记错不会带偏预测）。
4. `avgCycle` = 剩余区间的**线性加权平均**（越近的周期权重越高，权重 1..n）四舍五入。
5. 无有效区间时回退：最近记录的 `cycle_days`（`setting`）→ 默认 28（`default`）。
6. `variationDays` = 参与推算区间的总体标准差四舍五入。
7. `nextStart = 最近开始日 + avgCycle`；若算出的 `nextStart <= 最近开始日`，再顺延一个周期。
8. `durationDays`：优先最近一条的 `end_date - start_date + 1`；否则由有效区间的（结束-开始+1）均值四舍五入；否则 5。
9. 只返回有记录的 subject。

前端用本地日期计算：`daysUntil = nextStart - 今天`；`0 <= 已过天数 < durationDays` 显示「经期第 N 天」；`daysUntil <= 3` 高亮提醒；`variationDays >= 2` 时同时展示波动范围。

## 规矩

### 列表

`GET /api/rules?type=&status=`

- `type` 可选：`redline/rule/suggestion`；`status` 可选：`active`（默认）/ `archived` / `all`。
- 排序：`global 置顶 > list 置顶 > effective 降序 > updated_at DESC`。

```json
[
  {
    "id": "rule_ab12cd34ef56",
    "author_id": "u_xxx",
    "type": "redline",
    "title": "吵架不过夜",
    "content": "再生气也要在睡前和好",
    "status": "active",
    "agreedIds": ["u_xxx", "u_yyy"],
    "effective": true,
    "pin_scope": "list",
    "created_at": "2026-09-16T02:00:00.000Z",
    "updated_at": "2026-09-16T02:00:00.000Z",
    "author": { "id": "u_xxx", "nickname": "小艾", "avatar_url": "" }
  }
]
```

### 新建

`POST /api/rules`（需 `Idempotency-Key`）

```json
{ "type": "rule", "title": "每天说晚安", "content": "睡前互道晚安" }
```

- `type` 缺省 `rule`；枚举校验失败 → 400 `INVALID_RULE_TYPE`
- 创建后 `agreedIds = [当前用户]`，`effective = false`（等待对方认同）

### 修改 / 删除

`PUT /api/rules/:id`

```json
{ "type": "suggestion", "title": "…", "content": "…", "status": "archived" }
```

- 仅 `type/title/content` 变化时 → `agreedIds` 重置为 `[当前用户]`（需重新认同）
- 仅 `status` 变化不重置认同
- 不存在 → 404 `RULE_NOT_FOUND`

`DELETE /api/rules/:id` → 删除并清理置顶。

### 认同 / 撤回

`PUT /api/rules/:id/agree`

切换当前用户的认同状态（未认同 → 认同；已认同 → 撤回），返回更新后的 rule。
两名成员都在 `agreedIds` 中时 `effective: true`。

### 待认同数

`GET /api/rules/pending/count` → `{ "count": 1 }`

统计：`status = 'active'` 且 `author_id != 我` 且我不在 `agreedIds` 中。

> 注意：必须注册在 `GET /api/rules/:id` 之前，避免被 `:id` 参数路由吞掉。

## 置顶

### 设置 / 取消

`PUT /api/pins`

```json
{ "targetType": "care", "targetId": "care_ab12cd34ef56", "scope": "global" }
```

- `targetType` 仅 `care` / `rule`，否则 400 `INVALID_PIN_TARGET_TYPE`
- `scope` 仅 `none` / `list` / `global`，否则 400 `INVALID_PIN_SCOPE`
- `scope = "none"` 即取消置顶（删除置顶行）
- 目标不存在 → 404 `PIN_TARGET_NOT_FOUND`
- 成功返回 `{ "targetType": "care", "targetId": "care_ab12cd34ef56", "scope": "global" }`
- 广播 `pin:updated`

### 全站置顶列表

`GET /api/pins/global`

按置顶时间倒序；解析目标内容，目标已删除的孤儿行跳过。

```json
{
  "items": [
    {
      "targetType": "rule",
      "targetId": "rule_ab12cd34ef56",
      "title": "吵架不过夜",
      "content": "再生气也要在睡前和好",
      "type": "redline",
      "category": null,
      "severity": null,
      "subject_id": null,
      "pin_scope": "global",
      "pinnedAt": "2026-09-16T02:00:00.000Z",
      "updatedAt": "2026-09-16T02:00:00.000Z"
    }
  ]
}
```

> `type` 仅 rule 条目有值；`category/severity/subject_id` 仅 care 条目有值。

## Dashboard 增量

`GET /api/dashboard` 响应新增 `careSummary`（前端首页关怀卡使用，倒计时由前端计算）：

```json
{
  "careSummary": {
    "periods": [
      {
        "subject": { "id": "u_yyy", "nickname": "小博", "avatar_url": "" },
        "latestStart": "2026-09-01",
        "latestEnd": "2026-09-05",
        "durationDays": 5,
        "avgCycle": 28,
        "cycleSource": "history",
        "variationDays": 2,
        "intervals": 3,
        "nextStart": "2026-09-29"
      }
    ],
    "alerts": [
      {
        "id": "care_ab12cd34ef56",
        "title": "芒果过敏",
        "severity": "severe",
        "category": "allergy",
        "subject": { "id": "u_yyy", "nickname": "小博", "avatar_url": "" }
      }
    ]
  }
}
```

- `alerts`：`allergy` 且 `severity` 为 `moderate/severe` 的条目，`severe` 优先，最多 3 条。

## Socket 事件

| 事件 | 负载 | 触发 |
|---|---|---|
| `care:created` | careItem | 新建档案 |
| `care:updated` | careItem | 修改档案 |
| `care:deleted` | `{ id }` | 删除档案 |
| `rule:created` | rule | 新建规矩 |
| `rule:updated` | rule | 修改规矩（含认同状态变化） |
| `rule:deleted` | `{ id }` | 删除规矩 |
| `rule:agreed` | `{ rule, actorId }` | 认同/撤回（作者据此弹「Ta 认同了」提示） |
| `pin:updated` | `{ targetType, targetId, scope }` | 置顶变化 |
| `profile:updated` | `{ actorId, gender, partnerId, partnerGender }` | 一方设置性别，对方自动同步（例假默认对象联动） |

## 错误码

| code | HTTP | 含义 |
|---|---|---|
| `CARE_ITEM_NOT_FOUND` | 404 | 档案不存在 |
| `INVALID_CARE_CATEGORY` | 400 | 分类非法 |
| `INVALID_CARE_SUBJECT` | 400 | 档案对象不是情侣成员 |
| `INVALID_CARE_SEVERITY` | 400 | 严重程度非法 |
| `INVALID_PERIOD_RANGE` | 400 | 例假日期区间非法 |
| `INVALID_CYCLE_DAYS` | 400 | 周期天数超出 15~60 |
| `RULE_NOT_FOUND` | 404 | 规矩不存在 |
| `INVALID_RULE_TYPE` | 400 | 规矩类型非法 |
| `PIN_TARGET_NOT_FOUND` | 404 | 置顶目标不存在 |
| `INVALID_PIN_TARGET_TYPE` | 400 | 置顶类型不支持 |
| `INVALID_PIN_SCOPE` | 400 | 置顶级别非法 |

## 前端路由约定

| 路径 | name | 说明 |
|---|---|---|
| `/notebook?tab=care\|period\|rule` | `notebook` | 小本本（默认 `care`） |
| `/notebook/care/new?category=&subject=` | `care-new` | 新增档案 |
| `/notebook/care/:id/edit` | `care-edit` | 编辑档案 |
| `/notebook/rule/new?type=` | `rule-new` | 新增规矩 |
| `/notebook/rule/:id/edit` | `rule-edit` | 编辑规矩 |

## 明确不接入

分享链接（share）、公开观测台（observatory/public）、时间线（timeline）、恋爱树与统计（stats/tree）、心语陪伴 AI 上下文一律不读取小本本数据。导出（`GET /api/export`）通过整库打包自动包含。
