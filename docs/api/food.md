# 美食（Food）契约

> 记录「哪家的什么好吃」：一家店一条记录，菜品存在店下（JSON 数组）；
> 支持 想去/去过/常去、评分、营业时间、电话、人均、地图坐标与照片。
> 双人空间共享，所有读写都校验情侣关系。

## 数据模型

### food_places（店）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | `food_` + uuid 前 12 位 |
| author_id | TEXT | 记录人 |
| name | TEXT | 店名，1~40 字 |
| category | TEXT | `snack` 小吃 / `meal` 正餐 / `hotpot` 火锅 / `bbq` 烧烤 / `dessert` 甜品 / `drink` 饮品 / `other` 其他 |
| status | TEXT | `want` 想去 / `visited` 去过 / `favorite` 常去 |
| rating | INTEGER | 1~5，可空 |
| location | TEXT | 地点描述（≤80 字，可由地图反查填入） |
| longitude / latitude | REAL | 坐标，可空（为空不出现在地图） |
| hours | TEXT | 营业时间，自由文本（≤80 字） |
| phone | TEXT | 电话（≤30 字） |
| avg_price | INTEGER | 人均（元，0~9999，可空） |
| note | TEXT | 总评（≤1000 字） |
| dishes | TEXT | JSON `[{ id, name, rating, note, price }]`，最多 20 道 |
| photos | TEXT | JSON fileId 数组，最多 9 张（读侧解析为文件对象） |
| visited_at | TEXT | 最近去 / 想去的日期 `YYYY-MM-DD`，可空 |
| created_at / updated_at | TEXT | ISO8601 UTC |

- 图片沿用文件体系：落库存 `files.id`，读侧返回 `photos: [{ id, url, type, name }]`，
  同时附带 `photoIds`（原始 fileId，供更新时回收被移除的图片）。
- 排序：`常去` 优先，其后按最近更新倒序，`id` 兜底。

## 双人空间权限

- `GET /api/foods`、`GET /api/foods/map` 只返回当前用户所属情侣空间的店（按 `author_id` 归属过滤）。
- `GET /api/foods/:id`、`PUT`、`PUT /:id/status`、`DELETE`：作者必须是本人或同空间伴侣，否则 `403`。
- 未配对用户按单人空间处理（只有自己的数据）。

## API 契约

以下接口均需登录（`Authorization: Bearer <token>`）。

### 1. GET /api/foods

`?status=&category=&keyword=&offset=&limit=`

- `status` / `category` 枚举过滤；`keyword` 匹配 店名 / 总评 / 地点 / 菜品 JSON
- 传 `offset/limit` 返回 `{ items, total }`（`limit` 默认 20、最大 50）；不传返回数组
- 单条响应含 `dishes`（数组）、`photos`（文件对象）、`photoIds`、`author`

### 2. GET /api/foods/map

返回当前空间内**有坐标**的店（轻量字段：`id, name, category, status, rating, location, longitude, latitude, dishes`），供恋爱地图「美食」图层使用。

### 3. POST /api/foods（需 `Idempotency-Key`）

```json
{
  "name": "老陈家炒河粉",
  "category": "snack",
  "status": "want",
  "rating": 4,
  "location": "小南门",
  "longitude": 108.94,
  "latitude": 34.26,
  "hours": "10:30-21:00 周一休",
  "phone": "13800000000",
  "avgPrice": 15,
  "note": "锅气足",
  "visitedAt": "2026-09-18",
  "dishes": [{ "name": "炒河粉", "rating": 5, "note": "必点", "price": 10 }],
  "photos": ["1234567890123456"]
}
```

- 校验：店名必填 ≤40；枚举合法；评分 1~5；人均 0~9999；日期 `YYYY-MM-DD`；
  菜品 ≤20（名 ≤20、备注 ≤50）；图片 ≤9；坐标范围合法
- 菜品 `id` 缺省由服务端生成（`fd_` + uuid 前 12 位）

### 4. PUT /api/foods/:id

局部更新；未提交字段保持原值。`dishes` / `photos` 为**全量替换**：

- `photos` 被替换时，移除的图片会走文件墓碑软删（不阻断主流程）
- 菜品替换时保留已提交的 `id`

### 5. PUT /api/foods/:id/status

```json
{ "status": "visited" }
```

`want` / `visited` / `favorite` 三态流转，返回更新后的店。

### 6. DELETE /api/foods/:id

删除记录，并软删全部图片文件。

### 7. GET /api/foods/:id/moments

店详情「去过的约会」：返回关联的瞬间摘要（`id / content / mood / moment_date / location / photos / author`），
按发生日期倒序，最多 50 条。权限同详情。

### 8. POST /api/foods/parse（AI 粘贴成店）

```json
{ "text": "老陈家炒河粉，晚上六点开门，炒河粉和牛腩粉超好吃，人均 15 左右" }
```

把用户主动粘贴的一段探店笔记提取成表单草稿。**只预填、不落库**；结果由用户核对后手动保存。

- 输入 ≤ 800 字（`FOOD_EXTRACT_MAX_LENGTH`），否则 `400`
- 政策唯一来源：`server/src/modules/food/food.policy.js`；出站数据只有这段粘贴文本，
  不读取库内任何资源；不受「AI 建议」开关影响（显式动作触发）
- 模型输出经 `food.draft.js` 白名单校验：分类枚举、评分 1~5、人均 0~9999、菜品 ≤10、长度截断；
  未提及字段留空，脏 JSON → `502 AI_RESPONSE_INVALID`
- 未配置密钥 → `503 AI_NOT_CONFIGURED`；调用失败 → `503 AI_UNAVAILABLE`

```json
{
  "draft": {
    "name": "老陈家炒河粉",
    "category": "snack",
    "rating": 5,
    "hours": "18:00 开门",
    "phone": "",
    "avgPrice": 15,
    "location": "",
    "note": "",
    "dishes": [
      { "name": "炒河粉", "rating": null, "note": "超好吃", "price": null },
      { "name": "牛腩粉", "rating": null, "note": "超好吃", "price": null }
    ]
  }
}
```

## Socket 事件（房间 `couple:{pairCode}`）

| 事件 | 负载 | 触发 |
|---|---|---|
| `food:created` | foodPlace | 新建 |
| `food:updated` | foodPlace | 更新 / 状态流转 / 约会打卡自动标记 |
| `food:deleted` | `{ id }` | 删除 |

## 错误码

| code | HTTP | 含义 |
|---|---|---|
| `FOOD_NOT_FOUND` | 404 | 店不存在 |
| `FORBIDDEN` | 403 | 不是本人 / 同空间伴侣的资源 |
| `BAD_REQUEST` | 400 | 字段校验失败（店名/评分/人均/坐标/日期/菜品/图片等） |

## 前端路由

| 路径 | name | 说明 |
|---|---|---|
| `/foods` | `foods` | 美食列表（状态/分类筛选 + 搜索） |
| `/foods/new` | `food-new` | 记一家店 |
| `/foods/:id/edit` | `food-edit` | 编辑 |
| `/foods/:id` | `food-detail` | 详情（菜品、避雷提示、照片、评论、去过的约会） |

## 与其他模块的集成

- **约会打卡（瞬间 ↔ 店）**：瞬间创建/编辑接受 `placeIds`（最多 5 家，自动过滤非本空间 id），
  响应带 `places: [{ id, name, category, status, rating }]`；瞬间列表按关联店名也能搜到。
  关联「想去」的店时自动标记为「去过」并写 `visited_at = 瞬间日期`（`markVisited` 仅作用于 `want`）。
  删除瞬间或店都会清理 `moment_places` 关联行。
- **恋爱地图**：`GET /api/foods/map` 作为「美食」图层与足迹叠加展示，标记点击可进详情。
- **时间线**：`status` 为 `visited/favorite` 的店进入 `food` kind（时间取 `visited_at || created_at`）。
- **首页**：模块入口「🍜 美食」与统计卡「美食 N 家」。
- **评论**：`comments.target_type = 'food'`，权限按 `food_places.author_id` 判定；
  删除店时级联清理评论与已读记录（见 `docs/api/comment.md`）。
- **置顶**：`PUT /api/pins` 支持 `targetType = 'food'`；列表置顶在美食列表排最前，
  全站置顶进入顶部横幅与首页「我们记着」，点击直达店详情（见 `docs/api/notebook.md` 置顶章节）。
- **分享链接**：`includeFoods` 开关（见 `docs/api/share.md`）；开启时分享页展示「美食地图」区块，
  仅包含 `visited/favorite`，不下发「想去」。
- **忌口避雷（前端规则）**：详情页读取 `care` 的 `diet/allergy` 条目，与店名/菜品名做双向名称包含匹配，
  命中时提示「可能踩到忌口」。仅按名称匹配、不调用模型；具体以实际配料为准。
