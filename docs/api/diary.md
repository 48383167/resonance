# 日记 API

## 列表分页

`GET /api/entries?offset=&limit=`

- 不传 `offset/limit`：保持旧契约，返回日记数组
- 传任一参数：返回分页对象 `{ items, total }`

```json
{ "items": [日记], "total": 12 }
```

- `offset` 默认 0；`limit` 默认 20、最大 50（超出自动收敛）
- 排序：`created_at DESC, id DESC`（id 兜底，保证翻页不重不漏）
- 只对当页挂载正文分片、附件与评论数（正文/附件批量查询）

## 编辑日记

`PUT /api/entries/:id`

仅日记正文作者可以编辑。请求体为完整日记内容，`media` 数组会替换原有附件。

```json
{
  "title": "今天的名字",
  "content": "日记正文",
  "typingSpeed": 42,
  "deleteCount": 3,
  "pauseDuration": 1200,
  "weatherCode": 0,
  "timeColorHex": "#7a5ba8",
  "media": [
    { "fileId": "文件 ID", "type": "image" }
  ]
}
```

成功响应：`{ "ok": true, "data": 日记详情 }`
