// AI 整理建议（档案 / 规矩）的服务端参数。
// 不做每日次数限制：靠内容哈希缓存控制——内容未变绝不调用模型。
// 出站载荷上限：档案只发标题；规矩发标题 + 少量条目文本
export const SUGGESTION_MAX_CARE_ITEMS = 60
export const SUGGESTION_MAX_RULES = 40
export const SUGGESTION_MAX_RULE_TEXTS = 12
export const SUGGESTION_TEXT_MAX_LENGTH = 40
