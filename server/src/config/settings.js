// —— 本地配置项 ——
// 项目级可调配置，按需修改本文件即可，无需改业务代码。
// 环境变量（如 RESONANCE_DATA_DIR）优先级高于此处的配置。

// 数据目录：存放 database.sqlite 与 media/。
// 留空 = 默认使用项目根目录；
// 支持相对路径（基于项目根目录解析，如 'data' 或 './data'），也支持绝对路径（如 'D:/resonance-data'）。
export const dataDir = 'server/data'
