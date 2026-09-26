# 内容未读 API（Ta 新增、我还没看过）

统一回答一个问题：**某个模块里，有哪些内容是 Ta 新增的、我打开列表时还没看过的？**

- 列表条目会带上 `is_unread`，前端据此画未读小圆点
- 底部导航 / 首页模块卡显示未读数字角标（超过 99 显示 `99+`）
- 语义与既有的评论未读一致：**没有已读记录 = 从未打开过该模块列表，则对方的内容全部视为未读**

## 未读规则（唯一政策来源 `server/src/modules/read/read.registry.js`）

| 模块键 | 含义 | 作者列 | 备注 |
| --- | --- | --- | --- |
| `entry` | 日记 | `entry_contents.user_id` | 日记本表无作者列；我在正文里没有分片才算 Ta 写的 |
| `moment` | 瞬间 | `moments.user_id` | |
| `letter` | 情书 | `love_letters.sender_id` | **逐封已读**，不走时间水位 |
| `album` | 相册 | `albums.author_id` | 旧数据无作者 → 按「非未读」处理 |
| `wish` | 心愿 | `wish_items.proposer_id` | |
| `capsule` | 胶囊 | `time_capsules.author_id` | |
| `anniversary` | 纪念日 | `anniversaries.author_id` | 旧数据无作者 → 按「非未读」处理 |
| `food` | 美食 | `food_places.author_id` | |
| `care` | 档案 | `care_items.author_id` | 例假（`category = 'period'`）不参与 |
| `rule` | 规矩 | `couple_rules.author_id` | |

除情书外，其余模块采用**时间水位**：

```
未读 = 作者不是我 且 created_at > 我上次打开该模块列表的时间（module_reads.last_read_at）
```

情书沿用逐封已读（`love_letters.is_read`），打开某一封才消一封，不会因为「打开列表」整批变已读。

## 汇总

`GET /api/reads/summary`

```json
{
  "entry": 3,
  "moment": 1,
  "letter": 2,
  "album": 0,
  "wish": 0,
  "capsule": 0,
  "anniversary": 0,
  "food": 1,
  "care": 6,
  "rule": 1,
  "total": 14
}
```

`total` 为各模块之和；前端按模块键分发到对应入口，并对同一入口叠加评论未读（日记 / 瞬间 / 美食）。

## 打开列表即已读

`POST /api/reads/:module`

`:module` 取上表的模块键；未知模块 → 400 `BAD_REQUEST`。

- 把该模块的水位推到当前时间，**返回最新汇总**（前端可直接覆盖本地角标）
- 情书调用无效（不写水位），仅返回当前汇总
- 前端约定：**先取列表数据、再调用本接口**，这样本次进入仍能看到未读标记，下次进入才消失

## 列表字段

各模块列表接口新增只读字段：

| 字段 | 类型 | 位置 |
| --- | --- | --- |
| `is_unread` | boolean | 日记 / 瞬间 / 相册 / 心愿 / 胶囊 / 纪念日 / 美食 / 档案 / 规矩 的列表条目 |

与既有 `unread_comment_count`（评论未读）互不影响，两者可同时出现。

## 数据

`module_reads(user_id, module, last_read_at)`，主键 `(user_id, module)`；每个用户每个模块一行水位。

- 旧库启动时自动建表
- `albums` / `anniversaries` 由启动迁移补 `author_id` 列（旧行为 NULL）
- 相册与纪念日的创建接口已开始记录 `author_id`
