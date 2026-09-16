# 邮件提醒 API（QQ 邮箱 · 例假 / 纪念日）

邮件提醒是「通用邮件通道 + 可扩展触发点」：当前支持例假临近与纪念日提醒，
新增触发点只需在 `notification.service.js` 的 `runReminders` 里注册并在
`notification.policy.js` 补充文案政策。

- 所有接口均需登录；数据为当前用户自己的邮件设置。
- 邮件通道由服务器统一配置（QQ 邮箱 SMTP），授权码只保存在服务端 `.env`。
- 触发与发送由调度器执行，不占用心语陪伴的 AI 每日额度。

## 服务器配置（.env）

在项目根目录 `.env` 中填写（QQ 邮箱设置 → 账户 → 开启 POP3/SMTP 服务 → 生成授权码）：

```ini
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ号@qq.com
SMTP_PASS=邮箱授权码        # 不是 QQ 登录密码
SMTP_FROM=你的QQ号@qq.com   # 可省略，默认与 SMTP_USER 相同
```

- 未配置 `SMTP_USER` / `SMTP_PASS` 时，所有发送动作返回 503 `MAIL_NOT_CONFIGURED`，调度器自动跳过。
- 修改 `.env` 后需重启服务端。

## 触发规则

| 触发 | 时机 | 收件人 | 去重键 |
|---|---|---|---|
| 例假临近 | 进入预测日前 3 天窗口时发一封（服务重启会补发，过期不发） | 双方各自（填了邮箱且开启例假提醒） | `period:{subjectId}:{nextStart}:{userId}` |
| 纪念日（提前） | 下一次纪念日前 3 天 | 双方各自（开启纪念日提醒） | `anniversary:{id}:{occurrence}:d3:{userId}` |
| 纪念日（当天） | 纪念日当天 | 同上 | `anniversary:{id}:{occurrence}:d0:{userId}` |

- 例假预测使用 `GET /api/care/period/summary` 的 `nextStart`，日期为**预测**，邮件文案不承诺具体日期。
- 纪念日按「同月同日」每年重复（与纪念日模块语义一致）。
- 服务端调度：启动后 20 秒首检 + 每 6 小时轮询；发送记录写入 `notification_logs`，`sent` 不重发、`failed` 下轮重试。

## 接口

### 读取邮件设置

`GET /api/notifications/mail`

```json
{
  "email": "xxx@qq.com",
  "periodRemind": true,
  "anniversaryRemind": false,
  "aiContent": true,
  "mailerConfigured": true,
  "aiConfigured": false
}
```

### 保存邮件设置

`PUT /api/notifications/mail`（部分更新，字段可只传需要修改的）

```json
{ "email": "xxx@qq.com", "periodRemind": true, "anniversaryRemind": true, "aiContent": true }
```

- 邮箱留空表示不接收；非法邮箱 → 400 `INVALID_EMAIL`
- `periodRemind / anniversaryRemind / aiContent` 必须为布尔值
- `aiContent = true` 表示允许把例假/纪念日的必要信息（昵称、日期、天数）发送给 DeepSeek 生成邮件正文；关闭则使用内置文案

### 发送测试邮件

`POST /api/notifications/mail/test`（需 `Idempotency-Key`）

- 成功：`{ "sent": true, "email": "xxx@qq.com" }`
- 未配置 SMTP → 503 `MAIL_NOT_CONFIGURED`；未填邮箱 → 400 `MAIL_EMAIL_REQUIRED`

### 预览提醒内容

`GET /api/notifications/preview?type=period|anniversary`

返回将发送给每位收件人的主题与正文（只生成不发送；AI 不可用时为模板文案）：

```json
{
  "type": "period",
  "items": [
    {
      "role": "self",
      "recipient": { "id": "u_xxx", "nickname": "小艾" },
      "subject": "例假提醒 · 预计 3 天后",
      "body": "小提醒：预计 3 天后（2026-09-29 前后）例假要来啦…",
      "source": "template"
    }
  ]
}
```

- `role`：`self` 例假本人 / `partner` 伴侣（纪念日预览无此字段）
- `source`：`ai` 或 `template`
- 暂无可预览内容时 `items: []`，并带 `reason`（`NO_PERIOD_DATA` / `NO_ANNIVERSARY`）
- 未知类型 → 400 `INVALID_PREVIEW_TYPE`

### 立即检查并发送

`POST /api/notifications/run`（需 `Idempotency-Key`，排障/手测用）

- 未配置 SMTP：`{ "skipped": "MAIL_NOT_CONFIGURED", "sent": 0, "failed": 0 }`
- 正常：`{ "sent": 2, "failed": 0 }`；去重规则与调度器一致

## AI 文案政策

`server/src/modules/notification/notification.policy.js` 是邮件文案的**唯一来源**：

- `PERIOD_REMINDER_SYSTEM_PROMPT` / `ANNIVERSARY_REMINDER_SYSTEM_PROMPT`：约束语气、长度（60~120 字）、禁止医疗诊断、禁止制造焦虑、不提及系统与 AI
- 例假邮件按角色区分：收件人是本人 → 关心自己；收件人是伴侣 → 提醒照顾她
- 兜底文案函数：AI 未配置、超时、输出为空时使用；调用方还会做去 Markdown 与长度截断
- 修改政策后无需改业务代码；真实发送需配置 `DEEPSEEK_API_KEY` 才会启用 AI

## 数据库

- `user_mail_settings(user_id, email, period_remind, anniversary_remind, ai_content, updated_at)`
- `notification_logs(id, dedupe_key UNIQUE, user_id, email, status, error, created_at, updated_at)`

## 隐私边界

- 邮件经 QQ 邮箱服务器传输；开启 `aiContent` 时仅发送昵称、日期、天数等必要字段给 DeepSeek。
- 分享链接、观测台、时间线等公开出口不包含邮件设置与提醒记录。
