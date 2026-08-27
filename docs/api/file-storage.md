# 文件存储与文件 ID 契约

> 参考 youth-media（soy_media）设计：雪花文件 ID + SHA-256 哈希文件名 + 年月日分级目录 + files 元信息表。
> 业务表一律存文件 ID，读接口由服务端联 files 表解析出访问 URL。

## 文件 ID 规则（雪花 ID）

结构（对齐 youth-media SnowflakeIdGenerator）：

```
1 符号位 | 41 位时间戳(epoch 2021-03-01) | 5 位数据中心 | 5 位工作机 | 12 位序列
```

- 数据中心固定 `1`（媒体表）
- 工作机位 = 扩展名码：jpg/jpeg=1, png=2, gif=3, bmp=4, tiff=5, mp4=6, avi=7, mkv=8, mov=9, wmv=10, mp3=11, wav=12, flac=13, aac=14, webp=15, m4a=16；未知后缀 → 码 0（扩展名存 files 表）
- ID 为 64 位整数，前端/数据库统一用**十进制字符串**传输与存储
- 实现：`server/src/common/utils/snowflake.js`（BigInt，含时钟回拨守卫）

## 物理存储

- 根目录：`MEDIA_DIR`（data 目录下 `media/`），静态服务 `/media` 直指该目录
- 目录分级：`yyyy/MM/dd/`，日期由 **ID 内嵌时间戳**反推（上传时间 = ID 时间）
- 文件名：`SHA-256(8字节大端ID)` 前 8 字节转 16 进制（16 位） + `.扩展名`，防猜测
- 墓碑目录：`media/.trash/`（软删除的文件移入此处，原 URL 立即 404）

## files 表

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,        -- 雪花 ID 十进制字符串
  user_id TEXT,               -- 上传者（null = 系统/迁移）
  path TEXT NOT NULL,         -- 相对路径 yyyy/MM/dd/xxx.ext
  size INTEGER DEFAULT 0,
  mime TEXT DEFAULT '',
  original_name TEXT DEFAULT '',
  status INTEGER DEFAULT 1,   -- 1=正常 0=已删除（墓碑）
  deleted_at TEXT,
  trash_path TEXT,            -- 墓碑路径（相对 .trash）
  created_at TEXT
);
```

## 文件对象（读侧统一形状）

```json
{ "id": "雪花ID字符串", "url": "/media/2025/08/26/abc123.jpg", "type": "image|video|file", "name": "原名", "size": 12345 }
```

已软删除（status=0）的文件不出现在任何业务读接口中。

## API 契约

### POST /api/upload（auth，multipart 字段 file）

响应：

```json
{ "ok": true, "data": { "id": "...", "url": "/media/...", "type": "image", "size": 123, "name": "原名" } }
```

### DELETE /api/files/:id（auth）

软删除：物理文件移入 `.trash`，files.status=0。上传者本人或同一情侣空间的伴侣可删。
业务行删除时级联软删除其引用的文件（不物理删除、URL 立即失效）。

### 业务写接口（存 fileId）

| 模块 | 字段 | 值 |
|---|---|---|
| 日记创建 `POST /api/entries/solo` | `media` | `[{ "fileId": "...", "type": "image|video|file" }]` |
| 瞬间 `POST/PUT /api/moments` | `photos` | `["fileId", ...]` |
| 相册照片 `POST /api/albums/:id/photos` | body | `{ "fileId": "...", "caption": "" }` |
| 相册封面 `PUT /api/albums/:id/cover` | body | `{ "fileId": "..." }` |
| 相册创建 `POST /api/albums` | `coverFileId` | `"..."` 或 null |
| 胶囊 `POST /api/capsules` | `photoFileId` | `"..."` 或 null |
| 资料 `PUT /api/users/me` | `avatarFileId` | `"..."` 或 null |

### 业务读接口（输出 url）

- 日记 `media`：`[{ id, url, type, name }]`
- 瞬间 `photos`：`[{ id, url, type, name }]`
- 相册照片：`{ id, album_id, file_id, url, caption, created_at }`；相册：`{ ..., cover_url, cover_file_id }`
- 胶囊：`photoUrl`（解锁后可见）；用户：`avatar_url`（已解析）+ `avatar_file_id`

## 旧数据迁移

`npm run migrate:files`（server/scripts/migrate-files.js），幂等可重跑：

1. 旧平铺文件（`media/` 根目录）→ 按原文件名中的上传时间戳生成雪花 ID → 移入 `yyyy/MM/dd/` → 登记 files 表
2. 业务行回写：`avatar_url→avatar_file_id`、`entries.media`、`moment_photos.url→file_id`、`albums.cover_url→cover_file_id`、`album_photos.url→file_id`、`time_capsules.photo_url→photo_file_id`（旧 url 列清空作废）
3. 未被引用的孤儿文件一并迁移登记
