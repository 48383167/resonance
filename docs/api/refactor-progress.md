# 架构重构进度

依据 docs/Resonance_Architecture_Refactor_Plan.md §22 执行顺序维护。
每完成一个阶段或模块，由 architect 更新本文件。
所有 agent 以本文件确认当前所处阶段，不凭记忆猜测。

## 后端

- [x] Phase 1：搭建新架构骨架（server/src：config / common / middleware / modules / infrastructure）
- [x] Phase 2：统一 Response（保持 { ok, data, error } 契约）
- [x] Phase 3：统一 Error（AppError 系列 + Error Middleware）
- [x] Phase 4：拆分 Database（database.js 只管连接，SQL 移入 Repository）
- [x] Phase 5：Auth 模板模块
- [x] Phase 6：Couple 核心模块
- [x] Phase 7：Diary 模块迁移（entries → diary）
- [x] Phase 8：Socket 模块化（infrastructure/socket + couple:{id} Room）
- [x] moment 模块迁移（moments → moment，含 moment:created 事件）
- [x] album / letter / wish / capsule / anniversary 模块迁移
- [x] theme / share / music / export 模块迁移
- [x] timeline / observatory / misc 模块迁移（聚合/公开/系统）
- [x] stats 共享聚合查询模块（stats/daysSincePaired/pairStartedAt/listUsers）
- [x] 旧 db.js / middleware.js / routes/ 全部移除（所有 SQL 已入各模块 repository）

## 前端

- [x] Phase 9a：API 层拆分（api.js → api/request.js + modules/*/*.api.js）
- [x] Phase 9b：views/components → modules/*/，通用组件归 shared/components/

## 约定

- 迁移某模块时，在 server/index.js 中用新路由一行替换旧挂载，保证 API 路径不变。
- 每个模块迁移完成的验收标准见重构计划 §24（含 smoke test 通过）。
