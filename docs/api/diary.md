# 日记 API

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
