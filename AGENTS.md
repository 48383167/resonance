# Resonance 项目开发规范

## 项目定位

《共鸣 Resonance》是一个双人恋爱日记与情侣空间应用。

核心业务数据围绕 Couple 双人空间进行隔离。

## 技术栈

### 后端

- Node.js
- Express 4
- ESM
- node:sqlite
- WAL
- Socket.IO
- JWT
- Multer
- JavaScript

禁止 TypeScript。

### 前端

- Vue 3.5
- Vue Router
- Vite 6
- Tailwind CSS v4
- animejs
- JavaScript

禁止 TypeScript。

## 后端架构

Route
↓
Controller
↓
Service
↓
Repository
↓
Database

## API 响应规范

成功：

{
"ok": true,
"data": {}
}

失败（error 为对象，code 机器可读，message 人类可读）：

{
"ok": false,
"error": {
"code": "DIARY_NOT_FOUND",
"message": "日记不存在"
}
}

迁移期兼容：旧路由可能仍返回字符串 error（{ "ok": false, "error": "提示" }），
前端解析时须兼容两种形态。新代码一律使用对象形态，
禁止再引入 { code, message, data } 包装。

## API 变更原则

涉及前后端的新功能：

1. 先定义 API Contract。
2. API 路径统一。
3. 请求参数统一。
4. 响应字段统一。
5. 前端不得猜测字段。
6. 后端修改 API 时必须同步检查前端。

## 双人空间权限

所有 Couple 私有资源必须进行权限校验。

禁止仅通过资源 ID 获取数据。

必须验证：

当前用户
↓
Couple
↓
资源所属 Couple

## Socket.IO

事件命名：

业务:动作

例如：

diary:created
diary:updated
diary:deleted

moment:created
letter:received

## 目录职责

server/ 仅放后端代码。

client/ 仅放前端代码。

跨端接口文档放：

docs/api/