# 底部导航 API（两人共用）

底部导航是**统一设置**：不分用户，两人看到同一套入口与顺序；任何一方修改后通过 socket `navigation:updated` 实时同步双方。

- 入口名称与 `client/src/shared/navigation.js` 的 `name` 一一对应
- 数量限制 1~5 个，默认 `["home","timeline","diary-list","companion"]`
- 底栏固定的「写日记」与「••• 更多」不参与自定义

## 读取

`GET /api/navigation`

```json
{ "items": ["home", "timeline", "diary-list", "companion"] }
```

## 保存

`PUT /api/navigation`

```json
{ "items": ["diary-list", "home", "wishes"] }
```

- 未知入口 / 重复 / 数量不在 1~5 → 400 `INVALID_NAV_ITEMS`
- 成功返回 `{ "items": [...] }`，并广播 `navigation:updated`（负载 `{ items }`）

## 合法入口

`home` / `timeline` / `diary-list` / `moments` / `letters` / `companion` / `albums` / `map` / `wishes` / `notebook` / `capsules` / `anniversaries` / `observatory` / `settings`

## 数据

`navigation_settings(id = 1, items JSON, updated_at)` 单例行，与 `observatory_settings` 同一模式；旧库启动时自动补建。
