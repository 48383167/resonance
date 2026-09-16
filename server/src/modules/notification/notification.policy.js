// 邮件提醒的内容政策：AI 系统提示词与兜底文案的唯一来源。
// 修改前请阅读 docs/api/notification.md —— AI 只影响文案，不改变触发规则与数据边界。

export const PERIOD_REMINDER_SYSTEM_PROMPT = `你是「共鸣」里的关怀提醒助手，为一对情侣写一封简短的例假提醒邮件正文。

严格规则：
- 只输出正文本身：不要标题、不要 Markdown、不要分点、不要解释，最多 1 个 emoji
- 中文，60~120 字，语气温柔、平等、不说教
- 例假日期只是预测，可能有几天误差：不要断言"一定哪天来"，不要制造焦虑或惊吓
- 不做医疗诊断、不给药物建议；身体不适是否就医由她自己判断
- 不要提及系统、AI、数据来源
- 收件人是例假本人时：关心她最近的状态，提醒保暖、休息、提前备好用品
- 收件人是她的伴侣时：提醒他多体谅和耐心、别惹她生气，准备热水 / 暖宝宝 / 红糖水这类具体的小事`

export const ANNIVERSARY_REMINDER_SYSTEM_PROMPT = `你是「共鸣」里的关怀提醒助手，为一对情侣写一封简短的纪念日提醒邮件正文。

严格规则：
- 只输出正文本身：不要标题、不要 Markdown、不要分点、不要解释，最多 1 个 emoji
- 中文，60~120 字，语气温柔、真诚，可以有一点仪式感，但不要夸张煽情
- 提前提醒时：提醒这个日子快到了，可以提前想想要怎么一起纪念
- 当天提醒时：送上祝福，提醒今天一起好好纪念
- 不要提及系统、AI、数据来源`

// 触发窗口：例假提前 3 天窗口内发一封；纪念日提前 3 天与当天各一封
export const PERIOD_WINDOW_DAYS = 3
export const ANNIVERSARY_WINDOW_DAYS = 3
export const ANNIVERSARY_DAY_OF_DAYS = 0

export function periodEmailSubject({ daysUntil }) {
  return `例假提醒 · 预计 ${daysUntil} 天后`
}

export function anniversaryEmailSubject({ title, daysUntil }) {
  return daysUntil === 0 ? `纪念日提醒 · 今天 ${title}` : `纪念日提醒 · ${title} 还有 ${daysUntil} 天`
}

export function fallbackPeriodBody({ role, subjectNickname, daysUntil, nextStart }) {
  if (role === 'self') {
    return `小提醒：预计 ${daysUntil} 天后（${nextStart} 前后）例假要来啦，提前备好用品，这几天注意保暖、少熬夜，肚子不舒服就好好休息。预测可能有几天误差，照顾好自己最重要。`
  }
  return `小提醒：${subjectNickname} 的例假预计 ${daysUntil} 天后（${nextStart} 前后）到来。这几天多体谅她一点，准备点热水、暖宝宝或红糖水，别惹她生气～预测可能有误差，多留心她的状态。`
}

export function fallbackAnniversaryBody({ title, date, daysUntil }) {
  if (daysUntil === 0) {
    return `今天是「${title}」，记得和 Ta 一起好好纪念这个属于你们的日子。`
  }
  return `再过 ${daysUntil} 天就是「${title}」（${date}）了，可以提前想想要怎么一起纪念。`
}
