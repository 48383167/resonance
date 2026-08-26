# 《共鸣（Resonance）》项目架构调整开发计划

## 1. 文档目标

本文档用于指导《共鸣（Resonance）》双人恋爱日记项目进行后端及前端架构调整。

本次调整的核心目标不是将 Node.js 项目机械改造成 Java 项目，而是借鉴成熟 Java 后端项目的分层思想，在保持 Node.js + Express + Vue 技术栈轻量化的前提下，实现：

* 清晰的业务边界
* Controller / Service / Repository 分层
* SQL 与业务逻辑解耦
* 前后端业务模块统一
* Socket.IO 与业务模块解耦
* 统一错误处理
* 统一参数校验
* 支持后续 SQLite 平滑迁移至 MySQL
* 支持后续功能持续扩展
* 保持现有 API 尽量不变
* 采用渐进式重构，避免一次性推倒重来

---

# 2. 当前项目架构分析

当前项目结构：

```text
Love/
├── package.json
├── Dockerfile
├── docker-compose.yml
├── nginx.conf.example
├── database.sqlite
│
├── server/
│   ├── index.js
│   ├── db.js
│   ├── middleware.js
│   ├── security.js
│   ├── socket.js
│   └── routes/
│       ├── auth
│       ├── entries
│       ├── moments
│       ├── albums
│       ├── letters
│       ├── capsules
│       ├── wishes
│       ├── anniversaries
│       ├── timeline
│       ├── theme
│       ├── music
│       ├── share
│       ├── export
│       ├── observatory
│       └── misc
│
├── client/
│   └── src/
│       ├── api.js
│       ├── socket.js
│       ├── router.js
│       ├── stores/
│       ├── composables/
│       ├── theme/
│       ├── views/
│       └── components/
│
├── scripts/
├── docs/
└── media/
```

当前架构的主要特点：

```text
Route
 ├── API 路由
 ├── 参数处理
 ├── 业务逻辑
 ├── SQL 操作
 ├── 权限判断
 └── 返回响应
```

随着业务模块增加，一个路由文件会同时承担多个职责。

例如：

```text
entries.js
```

可能同时包含：

```text
获取日记列表
新增日记
修改日记
删除日记
权限判断
SQL 查询
Socket 推送
响应处理
```

短期开发效率较高，但随着业务复杂度增加，维护成本会不断提高。

---

# 3. 本次架构调整核心原则

## 3.1 不推倒重来

本次调整禁止：

```text
删除原有 routes
一次性重写所有模块
修改全部 API
重新设计全部数据库
```

采用：

```text
旧模块
  ↓
新模块建立
  ↓
迁移一个功能
  ↓
测试
  ↓
迁移下一个功能
```

确保项目在整个重构过程中始终可以正常运行。

---

## 3.2 保持 API 兼容

重构前：

```http
GET /api/entries
POST /api/entries
PUT /api/entries/:id
DELETE /api/entries/:id
```

重构后：

```http
GET /api/entries
POST /api/entries
PUT /api/entries/:id
DELETE /api/entries/:id
```

原则：

> 内部架构可以变化，对外 API 尽量不变化。

前端无需因为后端架构重构而进行大规模修改。

---

## 3.3 不过度 Java 化

不引入以下没有实际需求的结构：

```text
Service
ServiceImpl
Mapper
Mapper.xml
Entity
DTO
VO
Assembler
Factory
Builder
Manager
Facade
```

当前项目采用轻量级结构：

```text
Route
↓
Controller
↓
Service
↓
Repository
↓
Database
```

根据实际业务复杂度再逐步增加：

```text
Schema
DTO
VO
Entity
```

---

# 4. 目标后端架构

最终后端结构：

```text
server/
│
├── index.js
│
└── src/
    │
    ├── config/
    │   ├── database.js
    │   ├── jwt.js
    │   ├── upload.js
    │   └── socket.js
    │
    ├── common/
    │   ├── response.js
    │   ├── errors/
    │   │   ├── AppError.js
    │   │   ├── BadRequestError.js
    │   │   ├── UnauthorizedError.js
    │   │   ├── ForbiddenError.js
    │   │   └── NotFoundError.js
    │   │
    │   ├── constants/
    │   │
    │   └── utils/
    │
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── error.middleware.js
    │   ├── security.middleware.js
    │   └── validate.middleware.js
    │
    ├── modules/
    │   │
    │   ├── auth/
    │   │   ├── auth.routes.js
    │   │   ├── auth.controller.js
    │   │   ├── auth.service.js
    │   │   ├── auth.repository.js
    │   │   └── auth.schema.js
    │   │
    │   ├── couple/
    │   │   ├── couple.routes.js
    │   │   ├── couple.controller.js
    │   │   ├── couple.service.js
    │   │   └── couple.repository.js
    │   │
    │   ├── diary/
    │   │   ├── diary.routes.js
    │   │   ├── diary.controller.js
    │   │   ├── diary.service.js
    │   │   ├── diary.repository.js
    │   │   └── diary.schema.js
    │   │
    │   ├── moment/
    │   │
    │   ├── album/
    │   │
    │   ├── letter/
    │   │
    │   ├── capsule/
    │   │
    │   ├── wish/
    │   │
    │   ├── anniversary/
    │   │
    │   ├── timeline/
    │   │
    │   ├── theme/
    │   │
    │   ├── music/
    │   │
    │   ├── share/
    │   │
    │   ├── export/
    │   │
    │   └── observatory/
    │
    └── infrastructure/
        │
        ├── socket/
        │   ├── index.js
        │   ├── diary.socket.js
        │   ├── moment.socket.js
        │   └── notification.socket.js
        │
        ├── storage/
        │
        └── scheduler/
```

---

# 5. 后端调用链规范

统一采用：

```text
HTTP Request
      │
      ▼
    Route
      │
      ▼
 Controller
      │
      ▼
   Service
      │
      ▼
 Repository
      │
      ▼
  Database
```

每层职责严格区分。

---

# 6. Route 层规范

职责：

```text
定义 URL
定义 HTTP Method
挂载 Middleware
调用 Controller
```

禁止：

```text
SQL
复杂业务逻辑
Socket.IO 调用
```

示例：

```javascript
import express from 'express'
import * as diaryController from './diary.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get(
    '/',
    requireAuth,
    diaryController.list
)

router.get(
    '/:id',
    requireAuth,
    diaryController.detail
)

router.post(
    '/',
    requireAuth,
    diaryController.create
)

router.put(
    '/:id',
    requireAuth,
    diaryController.update
)

router.delete(
    '/:id',
    requireAuth,
    diaryController.remove
)

export default router
```

---

# 7. Controller 层规范

职责：

```text
获取 HTTP 参数
调用 Service
返回统一响应
```

Controller 禁止：

```text
复杂业务逻辑
SQL
数据库事务
Socket.IO 事件
```

示例：

```javascript
import * as diaryService from './diary.service.js'

export async function list(req, res, next) {
    try {

        const result =
            await diaryService.getDiaryList(
                req.user.id,
                req.query
            )

        res.success(result)

    } catch (error) {
        next(error)
    }
}
```

---

# 8. Service 层规范

Service 是整个系统的核心。

负责：

```text
业务规则
权限判断
业务流程
跨模块调用
事务控制
事件触发
```

例如创建日记：

```text
创建日记
    │
    ├── 获取用户情侣空间
    │
    ├── 校验用户权限
    │
    ├── 创建日记
    │
    ├── 更新情侣时间线
    │
    └── Socket 通知另一半
```

示例：

```javascript
import * as diaryRepository from './diary.repository.js'
import { getUserCouple } from '../couple/couple.service.js'
import { emitDiaryCreated } from '../../infrastructure/socket/diary.socket.js'

export async function createDiary(userId, data) {

    const couple =
        await getUserCouple(userId)

    if (!couple) {
        throw new Error('当前用户未绑定情侣空间')
    }

    const diary =
        await diaryRepository.create({
            ...data,
            userId,
            coupleId: couple.id
        })

    emitDiaryCreated(
        couple.id,
        diary
    )

    return diary
}
```

---

# 9. Repository 层规范

Repository 只负责：

```text
数据库查询
数据库新增
数据库修改
数据库删除
```

禁止：

```text
HTTP Request
Response
Socket
复杂业务逻辑
```

示例：

```javascript
import { db } from '../../config/database.js'

export function findById(id) {

    return db.prepare(`
        SELECT *
        FROM entries
        WHERE id = ?
    `).get(id)

}

export function findListByCoupleId(
    coupleId,
    limit,
    offset
) {

    return db.prepare(`
        SELECT *
        FROM entries
        WHERE couple_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        OFFSET ?
    `).all(
        coupleId,
        limit,
        offset
    )

}

export function create(data) {

    const result = db.prepare(`
        INSERT INTO entries (
            couple_id,
            user_id,
            content,
            created_at
        )
        VALUES (?, ?, ?, datetime('now'))
    `).run(
        data.coupleId,
        data.userId,
        data.content
    )

    return findById(
        result.lastInsertRowid
    )
}
```

---

# 10. Schema 参数校验规范

当前项目不引入 DTO。

参数校验采用：

```text
Schema
```

目录：

```text
diary/
└── diary.schema.js
```

职责：

```text
请求参数结构
参数类型
必填字段
长度限制
格式校验
```

推荐后续使用：

```text
Zod
```

例如：

```javascript
import { z } from 'zod'

export const createDiarySchema =
    z.object({

        content:
            z.string()
                .min(1)
                .max(5000),

        mood:
            z.string()
                .optional(),

        images:
            z.array(
                z.string()
            ).optional()

    })
```

调用：

```text
Request
   │
   ▼
Validate Middleware
   │
   ▼
Controller
```

---

# 11. 统一响应设计

继续保持现有契约：

```json
{
    "ok": true,
    "data": {}
}
```

错误：

```json
{
    "ok": false,
    "error": {
        "code": "DIARY_NOT_FOUND",
        "message": "日记不存在"
    }
}
```

统一封装：

```text
common/
└── response.js
```

示例：

```javascript
export function setupResponse(app) {

    app.use((req, res, next) => {

        res.success = function(data) {

            return res.json({
                ok: true,
                data
            })

        }

        res.fail = function(error) {

            return res.status(
                error.status || 500
            ).json({
                ok: false,
                error: {
                    code:
                        error.code ||
                        'INTERNAL_ERROR',

                    message:
                        error.message
                }
            })

        }

        next()

    })

}
```

---

# 12. 统一异常处理

Controller 不负责最终错误返回。

统一：

```text
Controller
    │
    ▼
throw Error
    │
    ▼
Error Middleware
    │
    ▼
统一 Response
```

结构：

```text
common/errors/

├── AppError.js
├── BadRequestError.js
├── UnauthorizedError.js
├── ForbiddenError.js
└── NotFoundError.js
```

例如：

```javascript
export class AppError extends Error {

    constructor(
        message,
        status = 500,
        code = 'INTERNAL_ERROR'
    ) {

        super(message)

        this.status = status
        this.code = code

    }

}
```

---

# 13. 权限架构设计

《共鸣》的核心权限关系：

```text
User
 │
 │ belongs to
 ▼
Couple
 │
 ├── Diary
 ├── Moment
 ├── Album
 ├── Letter
 ├── Wish
 ├── Capsule
 └── Anniversary
```

核心原则：

> 大部分业务数据必须通过 Couple 进行数据隔离。

错误方式：

```javascript
router.get('/:id', async (req, res) => {

    const diary =
        db.prepare(`
            SELECT *
            FROM entries
            WHERE id = ?
        `).get(req.params.id)

})
```

正确流程：

```text
User
 ↓
获取 Diary
 ↓
获取 Diary.coupleId
 ↓
判断 User 是否属于 Couple
 ↓
允许访问
```

建议在 Service 层统一处理。

例如：

```javascript
export async function getDiary(
    userId,
    diaryId
) {

    const diary =
        diaryRepository.findById(
            diaryId
        )

    if (!diary) {
        throw new NotFoundError(
            '日记不存在'
        )
    }

    await coupleService.assertUserInCouple(
        userId,
        diary.coupleId
    )

    return diary
}
```

后续可以抽象为：

```text
coupleAccess.service.js
```

统一提供：

```javascript
assertUserInCouple(
    userId,
    coupleId
)
```

---

# 14. Socket.IO 架构调整

当前 Socket.IO 不再作为所有业务的集中入口。

调整后：

```text
infrastructure/
└── socket/
    ├── index.js
    ├── diary.socket.js
    ├── moment.socket.js
    ├── letter.socket.js
    └── notification.socket.js
```

Socket Room：

```text
couple:{coupleId}
```

例如：

```text
couple:10001
```

用户登录后：

```text
User
 ↓
获取 CoupleId
 ↓
join
 ↓
couple:10001
```

日记创建：

```javascript
export function emitDiaryCreated(
    coupleId,
    diary
) {

    const io = getIO()

    io.to(
        `couple:${coupleId}`
    ).emit(
        'diary:created',
        diary
    )

}
```

业务调用：

```text
Diary Service
     │
     ▼
Diary Socket Event
     │
     ▼
Socket.IO
```

---

# 15. 数据库层调整计划

当前：

```text
db.js
├── SQLite 初始化
├── WAL
├── 建表
├── Migration
└── 数据库函数
```

调整后：

```text
config/
└── database.js
```

只负责：

```text
数据库连接
数据库初始化
WAL 配置
连接生命周期
```

SQL 移动到：

```text
modules/*/*.repository.js
```

例如：

```text
modules/
├── diary/
│   └── diary.repository.js
│
├── album/
│   └── album.repository.js
│
├── letter/
│   └── letter.repository.js
│
└── wish/
    └── wish.repository.js
```

---

# 16. 数据库迁移设计

后续建议将 Migration 独立：

```text
server/
└── migrations/

    ├── 001_initial.sql
    ├── 002_add_diary_weather.sql
    ├── 003_add_couple_status.sql
    └── migration-runner.js
```

当前：

```text
db.js
    ↓
启动时自动建表
```

逐步调整为：

```text
Migration
    ↓
记录当前版本
    ↓
执行未执行 Migration
```

维护表：

```sql
CREATE TABLE schema_migrations (
    version TEXT PRIMARY KEY,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

# 17. SQLite → MySQL 迁移预留

当前：

```text
Service
    ↓
Repository
    ↓
SQLite
```

未来：

```text
Service
    ↓
Repository
    ↓
MySQL
```

目标是：

```text
Service 不修改
Controller 不修改
Route 不修改
```

主要修改：

```text
database.js
Repository
Migration
```

例如未来：

```text
config/
├── database.js
├── sqlite.js
└── mysql.js
```

通过环境变量：

```env
DB_DRIVER=sqlite
```

未来：

```env
DB_DRIVER=mysql
```

数据库实现可以切换。

---

# 18. 前端架构调整

当前：

```text
src/
├── views/
├── components/
├── api.js
├── stores/
└── composables/
```

问题：

```text
业务组件
通用组件
页面
API
```

随着模块增加会越来越分散。

调整目标：

```text
src/
│
├── api/
│   └── request.js
│
├── modules/
│
│   ├── auth/
│   │   ├── views/
│   │   ├── components/
│   │   ├── auth.api.js
│   │   └── auth.store.js
│   │
│   ├── diary/
│   │   ├── views/
│   │   │   ├── DiaryList.vue
│   │   │   └── DiaryDetail.vue
│   │   │
│   │   ├── components/
│   │   │   ├── DiaryCard.vue
│   │   │   └── DiaryEditor.vue
│   │   │
│   │   ├── diary.api.js
│   │   └── diary.store.js
│   │
│   ├── album/
│   ├── moment/
│   ├── letter/
│   ├── capsule/
│   └── wish/
│
├── shared/
│   ├── components/
│   ├── composables/
│   └── utils/
│
├── stores/
├── router/
├── theme/
└── socket/
```

---

# 19. 前端 API 调整

当前：

```text
api.js
```

未来：

```text
api/
├── request.js
├── auth.api.js
├── diary.api.js
├── album.api.js
├── moment.api.js
└── ...
```

`request.js`：

```javascript
export async function request(
    url,
    options = {}
) {

    const response =
        await fetch(
            `/api${url}`,
            options
        )

    const result =
        await response.json()

    if (!result.ok) {
        throw new Error(
            result.error.message
        )
    }

    return result.data
}
```

业务 API：

```javascript
import { request } from '../../api/request.js'

export function getDiaryList(params) {

    return request(
        '/entries'
    )

}

export function createDiary(data) {

    return request(
        '/entries',
        {
            method: 'POST',
            body: JSON.stringify(data)
        }
    )

}
```

---

# 20. 前后端模块映射

建议建立统一模块名称。

| 业务    | 后端          | 前端          |
| ----- | ----------- | ----------- |
| 登录/用户 | auth        | auth        |
| 情侣空间  | couple      | couple      |
| 恋爱日记  | diary       | diary       |
| 恋爱时刻  | moment      | moment      |
| 相册    | album       | album       |
| 信箱    | letter      | letter      |
| 时间胶囊  | capsule     | capsule     |
| 心愿    | wish        | wish        |
| 纪念日   | anniversary | anniversary |
| 时间线   | timeline    | timeline    |
| 主题    | theme       | theme       |
| 音乐    | music       | music       |

最终形成：

```text
前端 diary
    ↓ API
后端 diary
    ↓ Service
数据库 diary 数据
```

保持业务认知一致。

---

# 21. 模块迁移优先级

不建议一次性迁移全部模块。

建议顺序：

## 第一阶段：基础架构

迁移：

```text
response
error
database
middleware
```

目标：

```text
统一响应
统一错误
数据库职责拆分
```

---

## 第二阶段：认证模块

```text
auth
```

原因：

```text
业务规模适中
涉及 JWT
涉及用户身份
适合作为架构模板
```

完成后形成标准：

```text
Route
Controller
Service
Repository
Schema
```

---

## 第三阶段：情侣核心

```text
couple
```

负责：

```text
用户情侣关系
Couple 数据隔离
业务访问权限
```

后续所有业务模块依赖此模块。

---

## 第四阶段：日记模块

```text
entries
↓
diary
```

作为第一个完整复杂业务模块。

迁移：

```text
列表
详情
创建
修改
删除
权限
Socket
```

---

## 第五阶段：回忆类模块

按照：

```text
moment
album
timeline
```

迁移。

---

## 第六阶段：互动模块

```text
letter
wish
capsule
anniversary
```

---

## 第七阶段：系统模块

最后迁移：

```text
theme
music
share
export
observatory
misc
```

---

# 22. 推荐开发执行顺序

## Phase 1：搭建新架构

```text
[ ] 创建 server/src
[ ] 创建 config
[ ] 创建 common
[ ] 创建 middleware
[ ] 创建 modules
[ ] 创建 infrastructure
```

完成标准：

```text
旧项目继续运行
新架构目录存在
index.js 可以挂载新模块
```

---

## Phase 2：统一 Response

```text
[ ] 创建 response.js
[ ] 保持 { ok, data, error } 契约
[ ] Controller 使用统一 Response
```

---

## Phase 3：统一 Error

```text
[ ] 创建 AppError
[ ] 创建 NotFoundError
[ ] 创建 UnauthorizedError
[ ] 创建 ForbiddenError
[ ] 创建 BadRequestError
[ ] 创建 Error Middleware
```

---

## Phase 4：拆分 Database

```text
[ ] database.js 只负责连接
[ ] SQL 从 db.js 移出
[ ] Repository 承担 SQL
[ ] 保留 WAL
[ ] 保留现有数据库
```

---

## Phase 5：完成 Auth 模板

```text
auth/
├── auth.routes.js
├── auth.controller.js
├── auth.service.js
├── auth.repository.js
└── auth.schema.js
```

完成后作为所有模块标准模板。

---

## Phase 6：完成 Couple 核心

```text
[ ] 用户获取 Couple
[ ] Couple 权限判断
[ ] assertUserInCouple
[ ] 统一数据隔离
```

---

## Phase 7：迁移 Diary

```text
entries.js
```

拆分为：

```text
diary/
├── diary.routes.js
├── diary.controller.js
├── diary.service.js
├── diary.repository.js
└── diary.schema.js
```

---

## Phase 8：Socket 模块化

```text
[ ] 创建 infrastructure/socket
[ ] 拆分业务 Socket Event
[ ] 使用 couple:{id} Room
[ ] Service 调用业务事件
```

---

## Phase 9：前端模块化

逐步迁移：

```text
views
↓
modules/*/views
```

以及：

```text
components
↓
modules/*/components
```

保留：

```text
shared/components
```

存放真正通用组件。

---

# 23. 重构期间禁止事项

重构过程中禁止：

```text
❌ 一次性修改所有 API

❌ 一次性修改所有前端页面

❌ 一次性迁移全部模块

❌ 重构时顺便修改数据库结构

❌ 重构时顺便修改 UI

❌ 重构时同时加入大量新功能

❌ 为了像 Java 创建 ServiceImpl

❌ 为了未来可能使用而提前创建 DTO / VO / Entity
```

每次重构只解决一个问题。

---

# 24. 每个模块完成标准

一个模块完成迁移必须满足：

```text
[ ] Route 只负责路由

[ ] Controller 不包含 SQL

[ ] Controller 不包含核心业务逻辑

[ ] Service 包含业务规则

[ ] Repository 包含 SQL

[ ] 权限判断集中在 Service

[ ] API 响应格式保持一致

[ ] 错误进入统一 Error Middleware

[ ] Socket 事件不散落在 Controller

[ ] 原 API 保持兼容

[ ] Smoke Test 通过
```

---

# 25. 最终目标架构

最终系统：

```text
                    Vue 3
                      │
                      │ HTTP
                      ▼
                 Express Route
                      │
                      ▼
                  Controller
                      │
                      ▼
                    Service
                  ↙    │    ↘
                 ▼     ▼     ▼
          Repository Socket  Other Service
                 │
                 ▼
               SQLite
                 │
                 ▼
              MySQL（未来）
```

前端：

```text
Vue Application
       │
       ├── modules
       │
       │   ├── diary
       │   ├── album
       │   ├── moment
       │   ├── letter
       │   └── ...
       │
       ├── shared
       │
       │   ├── components
       │   ├── composables
       │   └── utils
       │
       └── infrastructure
           ├── request
           └── socket
```

---

# 26. 架构演进路线

当前：

```text
Express
+
SQLite
+
Vue
+
Flat Routes
```

↓

第一阶段：

```text
Express
+
Controller
+
Service
+
Repository
+
SQLite
```

↓

第二阶段：

```text
Schema
+
统一异常
+
统一权限
+
模块化 Socket
```

↓

第三阶段：

```text
SQLite
↓
MySQL
```

↓

第四阶段，根据项目复杂度决定：

```text
DTO
VO
Entity
ORM
```

---

# 27. 最终架构原则

整个项目后续遵循以下原则：

> **业务优先于技术分层。**

即：

```text
Diary
 ├── Route
 ├── Controller
 ├── Service
 └── Repository
```

而不是：

```text
controllers/
services/
repositories/
```

然后把所有业务文件散落到不同目录。

推荐：

```text
modules/
    diary/
    album/
    moment/
    letter/
```

每个模块内部完成自己的完整生命周期。

---

# 28. 最终结论

《共鸣》的本次架构调整不追求：

> “把 Node.js 写成 Java”。

而是建立一套：

```text
轻量
+
模块化
+
清晰分层
+
可维护
+
可扩展
+
数据库可替换
```

的架构。

最终核心模式：

```text
业务模块
    │
    ├── Route
    │
    ├── Controller
    │
    ├── Service
    │
    ├── Repository
    │
    └── Schema
```

基础能力：

```text
Common
Middleware
Infrastructure
Config
```

数据库：

```text
SQLite
   ↓
MySQL
```

业务代码：

```text
尽量不变
```

---

## 推荐实际执行策略

第一步不要直接迁移 15 个模块。

建议先完成：

```text
基础架构
    ↓
Auth
    ↓
Couple
    ↓
Diary
```

其中 `Diary` 模块作为**标准参考实现**。

等这三个核心模块稳定后，再按照相同模板迁移：

```text
Moment
Album
Letter
Capsule
Wish
Anniversary
Timeline
Theme
Music
Share
Export
Observatory
```

这样整个《共鸣》项目可以在持续正常开发的过程中逐步完成架构升级，而不是经历一次高风险的“大爆炸式重构”。
