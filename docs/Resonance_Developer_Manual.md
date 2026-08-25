# 《共鸣 (Resonance)》- 专属双人恋爱日记开发手册

## 1. 项目概述 (Project Overview)

“共鸣 (Resonance)” 是一款专为情侣设计的私密日记应用。它打破了传统日记的单人流水账模式，通过“双人视角”、“情绪感知”和“时空底片”等独创交互，让记录本身充满仪式感。系统严格限制仅允许两人配对使用，确保数据的绝对私密性。同时提供对外展示的“观测台”页面，用于分享精选的高光时刻。

### 1.1 技术栈 (Tech Stack)
- **前端 (Frontend):** Vue 3 / React (推荐使用 Vite 构建)，配合 Anime.js (动效) 和 TailwindCSS。
- **后端 (Backend):** Node.js + Express / NestJS。
- **通信 (Communication):** WebSocket (Socket.io) 用于实现“同频呼吸”和“罗生门盲写”的实时状态同步。
- **数据库 (Database):** SQLite3 (单文件存储，极致轻量，方便物理打包备份)。

---

## 2. 核心功能与交互规范 (Core Features)

### 2.1 量子纠缠登录 (Pairing Login)
- **无注册概念：** 初始生成一个邀请码或动态二维码。两人在各自设备输入/扫码后，必须在 30 秒内同时点击屏幕中心的“引力场”按钮，完成 WebSocket 握手，建立永久配对。
- **数据流：** 配对成功后，SQLite 数据库锁定，不再接受第三个 UserID。

### 2.2 罗生门式盲写 (Dual Perspective Merge)
- **机制：** 一方发起盲写，另一方收到 Push/WebSocket 通知。
- **状态流转：**
  1. `pending`: 等待双方开始。
  2. `writing_A` / `writing_B`: 单方提交，此时数据加密，前端显示“Ta已写完，正在等你”。
  3. `merged`: 双方均提交。触发前端揭幕动画，两条内容在同一卡片中流淌汇合。

### 2.3 情绪墨水 (Kinetic Emotion Typing)
- **数据采集：** 前端监听 `input` 事件，计算 `WPM` (每分钟字数)、`backspace_count` (退格次数)、`pause_duration` (停顿时间)。
- **渲染规则：**
  - 高 WPM：字体加粗、边缘微发光。
  - 高退格/长停顿：字体透明度降低，增加轻微的 CSS `blur` 滤镜，模拟泪水晕开。

### 2.4 环境底片 (Sensory Snapshot)
- **采集指标：** 在创建日记时，抓取时间 (Time)、天气 API 数据 (Weather)、设备音量分贝预估 (Noise Level)。
- **背景生成：** 将参数映射为 CSS 渐变或 WebGL 粒子背景（如：深夜蓝+微光粒子、雨天灰绿+动态水波）。

---

## 3. 数据库设计 (Database Schema - SQLite)

由于是单文件数据库，结构设计以扁平、高效为主。

```sql
-- 1. 用户表 (严格限制2行数据)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    avatar_url TEXT,
    paired_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 日记主表
CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'solo' (单人), 'dual' (盲写), 'relay' (接力)
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT 0, -- 是否在展示页公开
    weather_code TEXT,  -- 环境底片：天气
    time_color_hex TEXT -- 环境底片：时间映射色
);

-- 3. 日记内容分片表 (支持多人多视角)
CREATE TABLE entry_contents (
    id TEXT PRIMARY KEY,
    entry_id TEXT REFERENCES entries(id),
    user_id TEXT REFERENCES users(id),
    content TEXT,
    typing_speed INTEGER, -- 情绪墨水：打字速度
    delete_count INTEGER, -- 情绪墨水：删除次数
    status TEXT DEFAULT 'draft' -- 'draft', 'submitted'
);
```

---

## 4. 核心 API 路由规划 (Core APIs)

| 方法 | 路由 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/pair` | 双人配对验证 (配合 WS) |
| `GET` | `/api/entries` | 获取日记星系/时间轴列表 |
| `POST` | `/api/entries/dual/start` | 发起罗生门盲写 |
| `PUT` | `/api/entries/dual/:id/submit`| 提交盲写分片内容 |
| `PATCH`| `/api/entries/:id/visibility` | 切换隐私状态 (私密/公开) |
| `GET` | `/api/public/observatory` | 对外展示页数据获取 |

---

## 5. 实时通信 (WebSocket Events)

使用 Socket.io 维护两人间的实时连接：
- `event: user_typing` -> 触发对方界面的“同频呼吸灯”涟漪效果。
- `event: dual_entry_submitted` -> 盲写模式下，一方提交后推送给另一方，更新状态锁。
- `event: user_presence` -> 对方上线/离线状态感知。

---

## 6. 部署与数据备份 (Deployment & Backup)

- **应用部署：** 可通过 Docker 容器化 Node.js 应用，前端静态文件由 Nginx 代理。
- **数据备份（极简）：** 
  - 只需要写一个简单的 Node.js 脚本或定时任务，每天将根目录下的 `database.sqlite` 拷贝一份加上日期戳即可。
  - 用户可在前端点击“导出时光机”，系统直接将 `.sqlite` 文件和媒体文件夹压缩为 `.zip` 供用户下载保存。
