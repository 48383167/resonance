# ♫ 共鸣 (Resonance) — 专属双人恋爱日记

严格限制两人配对使用的私密恋爱应用：账号密码登录、**情绪墨水**、**环境底片**，并参考 loveNest 移植了**恋爱瞬间、足迹地图、情书、相册、心愿清单、时间胶囊、纪念日、日记日历、只读分享、时光时间线**等完整模块。

技术栈：Vue 3 + Vite + TailwindCSS + Anime.js + Leaflet（前端）· Express + Socket.io + SQLite（后端，Node 内置 `node:sqlite`，零原生依赖）· JWT 鉴权。

## 快速开始

```bash
npm install          # 安装全部依赖（npm workspaces）
npm run dev          # 同时启动后端(:4000) 与前端(:5173)
```

浏览器打开 http://localhost:5173 ：

1. **注册**：第一个人注册（用户名+密码+昵称）后生成 6 位**配对码**；把配对码发给 Ta，第二个人注册时填写即完成配对。此后**严格锁定为两人**，无法注册第三个账号。
2. **登录**：之后每次用账号密码登录即可（JWT 有效期 7 天）。
3. **首页**：恋爱树随两人的记录成长（种子→嫩芽→小树→开花→繁茂），统计卡片与全部模块入口。
4. **时光时间线**：日记、瞬间、情书、心愿、胶囊、纪念日、照片全部汇入一条发光时间线，按日期分组并标注「在一起第 N 天」。
5. **写日记**：情绪墨水实时采集打字速度/删改/停顿，文字按情绪渲染；保存时采集环境底片（时间映射色、天气、音量）。
5. **恋爱瞬间**：心情 + 地点（地图选点）+ 照片 + 日期；支持心情/关键词/日期筛选。
6. **恋爱地图**：带坐标的瞬间化作足迹，按时间连成轨迹（Leaflet + OpenStreetMap，免 Key）。
7. **情书 / 相册 / 心愿清单（看板）/ 时间胶囊（到期解锁）/ 纪念日（倒计时）/ 日记日历**：见对应页面。
8. **分享**：设置页可生成只读分享链接（可选密码与有效期），亲友无需登录即可浏览。
9. **导出时光机**：下载 `database.sqlite + media/` 的 zip 备份。

## 生产部署

```bash
npm run build        # 构建前端到 client/dist
npm start            # Express 托管静态资源 + API + WebSocket → http://localhost:4000
```

或 Docker：

```bash
docker compose up -d --build
# 数据持久化在 ./data（database.sqlite + media/）
```

Nginx 反代示例见 `nginx.conf.example`。生产环境请设置环境变量 `JWT_SECRET`。

## 极简备份

```bash
npm run backup       # 将 database.sqlite 拷贝为 backups/database-YYYY-MM-DD.sqlite
```

## API 一览

认证接口（注册/登录/改密无需 x-user-id，其余接口需 `Authorization: Bearer <token>`）：

| 方法 | 路由 | 说明 |
| --- | --- | --- |
| `GET` | `/api/auth/state` | 当前注册人数（0/1/2） |
| `POST` | `/api/auth/register` | 注册（第二人需 `inviteCode`） |
| `POST` | `/api/auth/login` | 登录，返回 JWT |
| `GET` | `/api/auth/me` | 本人 + 伴侣 + 配对码（未配对时） |
| `POST` | `/api/auth/change-password` | 修改密码 |

业务接口：

| 方法 | 路由 | 说明 |
| --- | --- | --- |
| `GET/POST` | `/api/entries`，`/api/entries/solo` | 日记列表 / 写日记 |
| `GET` | `/api/timeline` | 时光时间线（全部点滴聚合） |
| `GET` | `/api/entries/:id`，`PATCH /api/entries/:id/visibility` | 日记详情 / 切换隐私状态 |
| `GET` | `/api/entries/calendar?year&month` | 日记日历 |
| `GET/POST/PUT/DELETE` | `/api/moments` | 恋爱瞬间（含筛选与坐标） |
| `GET` | `/api/moments/map` | 足迹地图数据 |
| `GET/POST/DELETE` | `/api/letters` | 情书（查看即已读） |
| `GET/POST/DELETE` | `/api/albums`，`POST /api/albums/:id/photos` | 相册与照片 |
| `GET/POST/PUT/DELETE` | `/api/wishes`，`PUT /api/wishes/:id/status` | 心愿看板 |
| `GET/POST/DELETE` | `/api/capsules` | 时间胶囊（未到期内容服务端遮蔽） |
| `GET/POST/PUT/DELETE` | `/api/anniversaries` | 纪念日（含倒计时） |
| `POST` | `/api/upload` | 图片上传（multipart，返回 /media URL） |
| `GET` | `/api/dashboard`、`/api/tree/state` | 首页聚合 / 恋爱树 |
| `PUT` | `/api/users/me` | 修改昵称/头像 |
| `POST/GET/DELETE` | `/api/share/create`、`/api/share/current` | 分享链接管理 |
| `GET` | `/api/public/observatory`、`/api/public/share/:token` | 公开观测台 / 只读分享（可选密码） |
| `GET` | `/api/export` | 导出时光机 zip |

## WebSocket 事件（Socket.io）

| 事件 | 方向 | 说明 |
| --- | --- | --- |
| `auth:join` | 客户端→服务端 | 携带 JWT 进入双人频道 |
| `user_presence` | 服务端→客户端 | 对方上线/离线感知 |

## 目录结构

```
server/           Express + Socket.io + node:sqlite
  routes/         auth / entries / moments / letters / albums / wishes /
                  capsules / anniversaries / share / misc / observatory / export
  db.js           建表与数据访问（全部模块）
  security.js     scrypt 密码哈希 + JWT
  socket.js       WebSocket 事件（token 认证）
client/           Vue 3 + Vite + TailwindCSS + Leaflet
  src/views/      登录 / 注册 / 首页 / 时光时间线 / 写日记 / 日记详情 /
                  瞬间 / 地图 / 情书 / 相册 / 心愿 / 胶囊 / 纪念日 / 日历 / 设置 / 分享 / 观测台
  src/components/ 呼吸灯 / 情绪编辑器 / 揭幕动画 / 环境底片 / 恋爱树 / 图片上传
scripts/
  backup.js       日期戳备份
  smoke.mjs       端到端冒烟测试（43 项断言）
```
