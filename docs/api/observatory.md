# 观测台（Observatory）公开照片契约

> 观测台展示的是情侣主动勾选「展示到观测台」的真实相册照片，而非日记正文。
> 正文、caption、未勾选照片、视频与附件一律不下发到公开接口。

## 数据模型

`album_photos` 新增一列：

```sql
show_in_observatory INTEGER NOT NULL DEFAULT 0  -- 1=展示到观测台，0=不展示
```

- 建表（`CREATE TABLE`）与老库补列（`ensureColumns`）均覆盖，迁移幂等。
- 只有**真实图片**（`files.mime LIKE 'image/%'`）才允许进入观测台，视频/附件被排除。

## API 契约

### 1. 观测台总展示开关

#### GET /api/observatory（需登录）

返回内部观测台数据。无论总开关状态如何，登录用户都可以查看已勾选的照片。

#### PATCH /api/observatory/visibility（需登录）

设置观测台是否对未登录访客展示。

请求体：

```json
{ "enabled": false }
```

成功响应：

```json
{
  "ok": true,
  "data": {
    "enabled": false,
    "photos": []
  }
}
```

当 `enabled=false` 时，公开入口 `/` 会跳转登录页，公开接口不会返回照片；内部 `/observatory` 仍可查看照片并重新开启展示。

### 2. PATCH /api/albums/:albumId/photos/:photoId/observatory（需登录）

设置某张相册照片是否展示到观测台。

请求参数：

| 位置 | 字段 | 类型 | 说明 |
|---|---|---|---|
| path | `albumId` | string | 相册 ID |
| path | `photoId` | string | 照片 ID（必须属于 `albumId`） |
| body | `showInObservatory` | boolean | 是否展示到观测台 |

请求体：

```json
{ "showInObservatory": true }
```

成功响应（`200`）：

```json
{
  "ok": true,
  "data": {
    "id": "ap_xxxxxxxx",
    "album_id": "a_xxxxxxxx",
    "file_id": "雪花ID字符串",
    "url": "/media/2025/08/26/abc123.jpg",
    "type": "image",
    "show_in_observatory": 1
  }
}
```

失败响应（统一错误处理，error 为对象形态）：

- `photoId` 不属于 `albumId`，或照片/相册不存在：`404` `{ code: "NOT_FOUND", message: "照片不存在" }`
- `showInObservatory` 非布尔值：`400` `{ code: "BAD_REQUEST", message: "showInObservatory 必须为布尔值" }`
- 开启展示但文件不是有效图片：`400` `{ code: "BAD_REQUEST", message: "只有有效图片可以展示到观测台" }`
- 未登录：`401` `{ code: "UNAUTHORIZED", message: "未登录或登录已过期" }`

### 3. GET /api/public/observatory（无需登录）

返回观测台公开图片列表。

成功响应（`200`）：

```json
{
  "ok": true,
  "data": {
    "photos": [
      { "id": "ap_xxxxxxxx", "url": "/media/2025/08/26/abc123.jpg", "type": "image" }
    ],
    "enabled": true
  }
}
```

过滤规则：

- `album_photos.show_in_observatory = 1`
- 关联文件 `files.status = 1`（已软删除的文件不出现）
- 且 `files.mime LIKE 'image/%'`（只返回图片，不暴露视频/附件）
- 按 `album_photos.created_at` 倒序

## 隐私与权限规则

- 公开接口不下发：日记 entries、正文、caption、未勾选照片、视频、附件、`file_path` 等内部字段。
- 只有照片拥有者所在双人空间成员（本项目严格双人配对、数据共享）可调用 PATCH 接口切换开关。
- 媒体 URL 统一由文件表解析为 `/media/{path}`，不返回物理路径或文件 ID 之外的内部字段。
