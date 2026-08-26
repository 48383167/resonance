# 主题色功能与 Java 架构迁移说明书

## 1. 文档目的

本文说明“共鸣”主题色功能的产品边界、数据结构、接口契约和前后端职责，作为后续迁移到典型 Java 前后端架构时的约束文档。

本功能是用户级设置，不是情侣共享设置。两位用户分别保存自己的主题配置，任何一方修改主题都不会影响另一方。

## 2. 当前功能边界

- 每个登录用户拥有一份独立主题配置。
- 主题配置由服务端持久化，登录后可以在其他设备恢复。
- 浏览器 `localStorage` 只保存按用户 ID 隔离的临时缓存，不作为数据源。
- 主题切换不使用 Socket.io，也不广播给伴侣。
- 登录页、注册页、公开观测台和公开分享页没有登录用户上下文，使用默认主题。
- 主题改变品牌色、渐变、光效、氛围色以及明暗视觉基底，不改变页面布局、字体和业务语义色。
- 删除、错误、成功、警告、解锁等状态色保持独立，不能被用户主题覆盖。
- 信纸的米黄色纸张和日记环境底片的历史颜色保持独立。

## 3. 主题配置模型

当前主题配置使用稳定、扁平的字段，不保存任意 CSS 字符串：

```json
{
  "themeKey": "starlight",
  "primaryColor": "#d8a7ff",
  "secondaryColor": "#7ec8ff",
  "ambientColor": "#070a18",
  "appearanceMode": "auto",
  "surfaceColor": null,
  "surfaceStrongColor": null,
  "textColor": null,
  "mutedTextColor": null,
  "borderColor": null
}
```

字段约定：

- `themeKey`：主题标识，例如 `starlight`、`rose-dusk`、`custom`。
- `primaryColor`：主色，用于按钮、主要强调文字和主要光效。
- `secondaryColor`：辅助色，用于渐变、次级强调和地图轨迹。
- `ambientColor`：氛围色，用于背景基底和背景光晕。
- `appearanceMode`：视觉基底，支持 `auto`、`light`、`dark`。
- `surfaceColor`：普通内容容器背景色，留空时自动生成。
- `surfaceStrongColor`：强化容器和浮层背景色，留空时自动生成。
- `textColor`：主文字色，留空时自动生成。
- `mutedTextColor`：次级文字色，留空时自动生成。
- `borderColor`：边框色，留空时自动生成。
- 当 `appearanceMode` 为 `auto` 时，由 `ambientColor` 的亮度自动推导明亮/暗色基底；选择 `light` 或 `dark` 时以显式设置为准。
- 全局背景渐变由 `ambientColor`、`primaryColor` 和 `secondaryColor` 在前端生成，保证页面背景与主题容器保持同一色相，不额外持久化渐变数组。

所有颜色必须是 6 位 HEX 格式，例如 `#d8a7ff`。这只是防止 CSS 注入的格式校验，不限制颜色明暗、颜色组合或自定义主题保存。

当前预置主题：

- 星河紫蓝
- 玫瑰晚霞
- 海盐薄荷
- 琥珀灯影
- 森林薄雾
- 晨曦蜜桃
- 晴空薄荷
- 月白奶油

## 4. REST 接口契约

### 4.1 获取当前用户主题

```text
GET /api/users/me/theme
Authorization: Bearer <token>
```

无配置时返回默认主题，不要求客户端先创建配置记录。

响应数据：

```json
{
  "themeKey": "starlight",
  "primaryColor": "#d8a7ff",
  "secondaryColor": "#7ec8ff",
  "ambientColor": "#070a18",
  "appearanceMode": "auto",
  "surfaceColor": null,
  "surfaceStrongColor": null,
  "textColor": null,
  "mutedTextColor": null,
  "borderColor": null,
  "updatedAt": "2026-08-26T00:00:00.000Z"
}
```

### 4.2 保存当前用户主题

```text
PUT /api/users/me/theme
Authorization: Bearer <token>
Content-Type: application/json
```

请求体是完整主题对象：

```json
{
  "themeKey": "custom",
  "primaryColor": "#ff9fba",
  "secondaryColor": "#7db8ff",
  "ambientColor": "#170b18",
  "appearanceMode": "auto",
  "surfaceColor": null,
  "surfaceStrongColor": null,
  "textColor": null,
  "mutedTextColor": null,
  "borderColor": null
}
```

`PUT` 必须以当前认证用户为目标，不接受请求体中的 `userId`。服务端使用 JWT 中的用户 ID 执行新增或更新。

服务端校验规则：

- `themeKey` 只能包含小写字母、数字、下划线和连字符，长度不超过 40。
- 三个基础颜色和已填写的细节颜色都必须匹配 `^#[0-9a-fA-F]{6}$`。
- `appearanceMode` 只能是 `auto`、`light` 或 `dark`。
- 不限制主色、辅助色和氛围色的明暗或搭配；前端可以根据背景自动生成辅助文字色，但不得阻止用户保存原始颜色。
- 更新应作为一次完整操作写入，避免只保存了一半颜色配置。

## 5. 数据库设计

当前 SQLite 表：

```sql
CREATE TABLE user_theme_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    theme_key TEXT NOT NULL DEFAULT 'starlight',
    primary_color TEXT NOT NULL DEFAULT '#d8a7ff',
    secondary_color TEXT NOT NULL DEFAULT '#7ec8ff',
    ambient_color TEXT NOT NULL DEFAULT '#070a18',
    appearance_mode TEXT NOT NULL DEFAULT 'auto',
    surface_color TEXT,
    surface_strong_color TEXT,
    text_color TEXT,
    muted_text_color TEXT,
    border_color TEXT,
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

设计约束：

- `user_id` 是主键，保证每个用户只有一份配置。
- 不增加 `couple_theme` 或 `pair_theme` 字段。
- 不把主题字段塞入 `users` 表，避免用户账号表承担可扩展偏好配置。
- 不存储任意 CSS、HTML 或脚本内容。
- 当前 Node 版本使用幂等建表和 SQLite upsert；迁移到 Java 时应转换为版本化数据库迁移。

## 6. 当前前端结构

```text
client/src/theme/presets.js
```

只保存预置主题目录和颜色规范，不负责用户数据请求。

```text
client/src/stores/theme.js
```

负责主题状态、服务端读取、服务端保存、缓存、HEX 解析、文字明度适配和 CSS 变量应用。页面不应自行操作 `document.documentElement`，也不应自行拼接主题颜色。

```text
client/src/views/Settings.vue
```

负责主题选择和编辑界面。预置主题和自定义颜色最终都通过同一份主题对象保存。

```text
client/src/style.css
```

提供主题变量和语义化样式接口：

```text
--accent
--accent-2
--accent-rgb
--accent-2-rgb
--accent-text
--accent-2-text
--ambient
--ambient-rgb
--accent-contrast
--page-bg
--page-bg-rgb
--surface-1
--surface-1-rgb
--surface-2
--surface-2-rgb
--text-primary
--text-primary-rgb
--text-secondary
--text-secondary-rgb
--border-subtle
--border-subtle-rgb
```

组件只能依赖这些变量或 `.surface-card`、`.surface-soft`、`.text-theme-primary`、`.text-accent` 等语义化类，不应重新引入 `text-violet-*`、`#d8a7ff` 之类的品牌硬编码。旧页面的白色 Tailwind 类由兼容层映射到主题令牌，后续新代码应直接使用语义类。

## 7. 用户生命周期

### 登录

1. 会话建立后得到当前用户 ID。
2. 主题模块按当前用户 ID 读取缓存并先应用。
3. 前端调用 `GET /api/users/me/theme` 获取服务端最新配置。
4. 服务端配置成功后覆盖缓存和当前 CSS 变量。

### 切换账号

1. 旧用户的异步请求返回后不得覆盖新用户主题。
2. 新用户加载前只能使用新用户自己的缓存或默认主题。
3. 不能使用无用户后缀的公共主题缓存键。

### 登出

1. 清除当前活动用户。
2. 取消旧用户请求对页面的影响。
3. 恢复默认主题。
4. 可以保留按用户 ID 隔离的缓存，但不得把旧用户主题直接展示给未登录页面。

## 8. 当前后端结构

当前 Node 工程是轻量实现，主题功能已经保持独立路由：

```text
server/routes/theme.js
server/db.js               主题表及数据访问函数
server/index.js             路由挂载
```

`server/routes/theme.js` 只处理 HTTP 参数、认证和响应转换。数据库读写集中在 `db.js` 的主题数据访问函数中。后续继续扩展主题时，不要把逻辑移动到 `misc.js` 或认证路由中。

## 9. Java 架构映射

迁移到典型 Java 后端时，建议使用以下模块：

```text
theme/
  controller/ThemeController.java
  service/UserThemeService.java
  repository/UserThemeRepository.java
  entity/UserThemeSetting.java
  dto/ThemeResponse.java
  dto/UpdateThemeRequest.java
```

职责对应关系：

- `ThemeController`：提供 `GET/PUT /api/users/me/theme`，从安全上下文取得当前用户 ID。
- `UserThemeService`：处理默认值、完整更新和业务校验。
- `UserThemeRepository`：只负责按 `userId` 查询和 upsert。
- `UserThemeSetting`：映射 `user_theme_settings` 表。
- `ThemeResponse`：返回 camelCase 字段，不能直接暴露数据库实体。
- `UpdateThemeRequest`：接收完整颜色配置，使用 Bean Validation 校验。

建议的 Java 接口形态：

```java
@GetMapping("/api/users/me/theme")
ThemeResponse getCurrentTheme(CurrentUser currentUser);

@PutMapping("/api/users/me/theme")
ThemeResponse updateCurrentTheme(
    CurrentUser currentUser,
    @Valid @RequestBody UpdateThemeRequest request
);
```

不要让主题服务查询伴侣信息，也不要在主题更新时发送情侣频道广播。主题是个人偏好，不是共享领域对象。

## 10. 后续扩展规则

- 新增主题色字段时，先更新接口契约和数据库迁移，再更新前端主题模块。
- 如果新增字体、圆角、阴影等视觉配置，应继续使用明确字段，不保存任意 CSS 文本。
- 如果未来需要浅色模式，应作为新的视觉方案单独设计，不能把当前三个颜色字段强行扩展成完整设计系统。
- 预置主题属于前端展示目录，服务端只保存主题标识和最终颜色值。
- 公开分享页若未来需要独立主题，应增加分享级主题字段，不能读取任一登录用户的个人主题。
- 主题设置不应进入 `auth/me` 响应，避免认证接口和偏好模块耦合。

## 11. 验收标准

- A 用户修改主题后，A 的页面立即更新。
- B 用户在自己的会话中仍保持 B 的主题。
- A、B 分别刷新页面后仍能恢复各自配置。
- A 登出、B 登录时不会短暂展示 A 的主题。
- 非法颜色无法通过接口保存。
- 预置主题和自定义主题都覆盖按钮、输入框、选择状态、时间线、地图、粒子和播放器等核心品牌视觉。
- 删除、错误、成功、警告、信纸和环境底片视觉语义不被破坏。
- `npm run build` 和主题相关冒烟测试通过。
