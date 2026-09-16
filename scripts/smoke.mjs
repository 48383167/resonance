// 端到端冒烟测试：注册/登录 → 用户主题隔离 → 日记 → 全模块 → 分享 → 评论 → 导出
// 前置：服务端已启动（建议 RESONANCE_DATA_DIR 指向临时目录，避免污染真实数据）
const BASE = process.env.RESONANCE_BASE || 'http://localhost:4000'
let failed = 0

function assert(name, cond, extra = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else { failed++; console.error(`  ✗ ${name} ${extra}`) }
}

async function http(method, url, body, token, isForm, idempotencyKey) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  // 创建类 POST 接口要求 Idempotency-Key；默认每次生成新 key，测试重放时可显式传入
  if (method === 'POST') headers['Idempotency-Key'] = idempotencyKey || crypto.randomUUID()
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  return res.json()
}

console.log('== 1. 注册与登录 ==')
const state0 = await http('GET', '/api/auth/state')
assert('初始 0 人', state0.data.userCount === 0)

const regA = await http('POST', '/api/auth/register', { username: 'alice', password: 'alice123', nickname: '小艾' })
assert('第一人注册成功并拿到配对码', regA.ok && regA.data.token && regA.data.inviteCode && !regA.data.partner)
const code = regA.data.inviteCode

const regBad = await http('POST', '/api/auth/register', { username: 'bob', password: 'bob12345', nickname: '小博', inviteCode: 'WRONG1' })
assert('错误配对码被拒绝', regBad.ok === false)

const regB = await http('POST', '/api/auth/register', { username: 'bob', password: 'bob12345', nickname: '小博', inviteCode: code })
assert('第二人凭码注册完成配对', regB.ok && regB.data.partner?.id === regA.data.me.id)

const regC = await http('POST', '/api/auth/register', { username: 'carol', password: 'carol123', nickname: '小卡', inviteCode: code })
assert('第三人注册被拒绝（严格两人）', regC.ok === false)

const loginA = await http('POST', '/api/auth/login', { username: 'alice', password: 'alice123' })
assert('登录成功', loginA.ok && loginA.data.token && loginA.data.me.username === 'alice')
const loginBad = await http('POST', '/api/auth/login', { username: 'alice', password: 'wrongpass' })
assert('错误密码被拒绝', loginBad.ok === false)

const meA = await http('GET', '/api/auth/me', null, loginA.data.token)
assert('会话返回伴侣', meA.ok && meA.data.partner?.username === 'bob')

const chPw = await http('POST', '/api/auth/change-password', { oldPassword: 'alice123', newPassword: 'alice456' }, loginA.data.token)
assert('修改密码成功', chPw.ok === true)
const loginA2 = await http('POST', '/api/auth/login', { username: 'alice', password: 'alice456' })
assert('新密码可登录', loginA2.ok === true)

const tokenA = loginA2.data.token
const tokenB = regB.data.token

console.log('== 2. 情感陪伴助手 ==')
const companionConsent0 = await http('GET', '/api/companion/consent', null, tokenA)
assert('情感助手初始未同意第三方处理', companionConsent0.ok && companionConsent0.data.consented === false)
const companionConsent = await http('PUT', '/api/companion/consent', { accepted: true }, tokenA)
assert('可明确同意第三方处理', companionConsent.ok && companionConsent.data.consented === true)
const companionConversation = await http('POST', '/api/companion/conversations', { title: '今晚想聊聊' }, tokenA)
assert('创建本人私有情感对话', companionConversation.ok && companionConversation.data.title === '今晚想聊聊')
const companionDetail = await http('GET', `/api/companion/conversations/${companionConversation.data.id}`, null, tokenA)
assert('本人可读取空情感对话', companionDetail.ok && companionDetail.data.messages.length === 0)
const companionCrossAccess = await http('GET', `/api/companion/conversations/${companionConversation.data.id}`, null, tokenB)
assert('伴侣不能读取私有情感对话', companionCrossAccess.ok === false
  && companionCrossAccess.error?.code === 'COMPANION_CONVERSATION_NOT_FOUND')
const companionList = await http('GET', '/api/companion/conversations', null, tokenA)
assert('情感对话只出现在本人列表', companionList.ok && companionList.data.some((item) => item.id === companionConversation.data.id))
const companionCrisis = await http('POST', `/api/companion/conversations/${companionConversation.data.id}/messages`, { content: '我吞了一瓶药' }, tokenA)
assert('危机文本由本地安全回复处理', companionCrisis.ok && companionCrisis.data.assistantMessage.content.includes('120'))
const companionEnglishCrisis = await http('POST', `/api/companion/conversations/${companionConversation.data.id}/messages`, { content: 'I will jump off a bridge' }, tokenA)
assert('英文危机文本不发送给模型', companionEnglishCrisis.ok && companionEnglishCrisis.data.assistantMessage.content.includes('120'))
const companionDelete = await http('DELETE', `/api/companion/conversations/${companionConversation.data.id}`, null, tokenA)
assert('可删除本人情感对话', companionDelete.ok === true)
const companionAfterDelete = await http('GET', `/api/companion/conversations/${companionConversation.data.id}`, null, tokenA)
assert('删除后情感对话不可读取', companionAfterDelete.ok === false)

await http('POST', '/api/share/create', { password: '', expireDays: 0 }, tokenA)
const shareProbe = await fetch(BASE + '/api/share/current', { headers: { Authorization: `Bearer ${tokenA}` } })
const shareEtag = shareProbe.headers.get('etag')
await shareProbe.arrayBuffer()
const conditionalShare = await fetch(BASE + '/api/share/current', {
  headers: { Authorization: `Bearer ${tokenA}`, ...(shareEtag ? { 'If-None-Match': shareEtag } : {}) },
})
assert('动态接口不返回无响应体的 304', conditionalShare.status !== 304)
await conditionalShare.arrayBuffer()
await http('DELETE', '/api/share/current', null, tokenA)

console.log('== 3. 用户独立主题 ==')
const themeA0 = await http('GET', '/api/users/me/theme', null, tokenA)
const themeB0 = await http('GET', '/api/users/me/theme', null, tokenB)
assert('两个用户都有默认主题', themeA0.ok && themeB0.ok && themeA0.data.themeKey === 'starlight'
  && themeB0.data.themeKey === 'starlight' && themeA0.data.updatedAt === null)
const themeA = await http('PUT', '/api/users/me/theme', {
  themeKey: 'rose-dusk', primaryColor: '#ff9fba', secondaryColor: '#ffcfad', ambientColor: '#170b18',
}, tokenA)
const themeBAfterA = await http('GET', '/api/users/me/theme', null, tokenB)
assert('A 修改主题不影响 B', themeA.ok && themeA.data.primaryColor === '#ff9fba'
  && themeBAfterA.data.primaryColor === '#d8a7ff')
const themeB = await http('PUT', '/api/users/me/theme', {
  themeKey: 'seafoam', primaryColor: '#82e6d0', secondaryColor: '#7db8ff', ambientColor: '#07171a',
}, tokenB)
const themeAAfterB = await http('GET', '/api/users/me/theme', null, tokenA)
assert('B 修改主题不影响 A', themeB.ok && themeB.data.primaryColor === '#82e6d0'
  && themeAAfterB.data.primaryColor === '#ff9fba')
const brightTheme = await http('PUT', '/api/users/me/theme', {
  themeKey: 'peach-morning', primaryColor: '#f0a0a6', secondaryColor: '#f4bd9e', ambientColor: '#fff0e6',
  appearanceMode: 'light', surfaceColor: '#fffaf7', surfaceStrongColor: '#ffffff',
  textColor: '#302b43', mutedTextColor: '#6e667b', borderColor: '#8d789d',
}, tokenA)
assert('明亮预置主题可保存', brightTheme.ok && brightTheme.data.themeKey === 'peach-morning'
  && brightTheme.data.appearanceMode === 'light' && brightTheme.data.surfaceColor === '#fffaf7')
const invalidTheme = await http('PUT', '/api/users/me/theme', {
  themeKey: 'custom', primaryColor: 'red', secondaryColor: '#7db8ff', ambientColor: '#07171a',
}, tokenA)
assert('非法主题颜色被拒绝', invalidTheme.ok === false)
const unreadableTheme = await http('PUT', '/api/users/me/theme', {
  themeKey: 'custom', primaryColor: '#000000', secondaryColor: '#ffffff', ambientColor: '#ffffff',
}, tokenA)
assert('任意颜色组合可保存', unreadableTheme.ok && unreadableTheme.data.primaryColor === '#000000'
  && unreadableTheme.data.secondaryColor === '#ffffff' && unreadableTheme.data.ambientColor === '#ffffff')

console.log('== 4. 日记 ==')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const fd = new FormData()
fd.append('file', new Blob([png], { type: 'image/png' }), 't.png')
const up = await http('POST', '/api/upload', fd, tokenA, true)
assert('图片上传返回 /media URL', up.ok && String(up.data.url).startsWith('/media/'))

const solo = await http('POST', '/api/entries/solo',
  { title: '夜航', content: '窗外的雨声像你说话的语气。', typingSpeed: 58, deleteCount: 3, pauseDuration: 1200, weatherCode: 61, timeColorHex: '#0b1d3a', media: [{ fileId: up.data.id, type: 'image' }] }, tokenA)
assert('写日记成功（含情绪墨水与附件）', solo.ok === true && solo.data.contents.length === 1
  && solo.data.contents[0].typing_speed === 58 && solo.data.media.length === 1)

const vis = await http('PATCH', `/api/entries/${solo.data.id}/visibility`, { isPublic: true }, tokenA)
assert('切换公开成功', Number(vis.data.is_public) === 1)

const obs = await http('GET', '/api/public/observatory')
assert('观测台公开接口返回开关与照片', obs.ok === true && typeof obs.data.enabled === 'boolean' && Array.isArray(obs.data.photos))

const temp = await http('POST', '/api/entries/solo', { title: '临时', content: '待删除', typingSpeed: 10 }, tokenA)
const del = await http('DELETE', `/api/entries/${temp.data.id}`, null, tokenA)
const afterDel = await http('GET', '/api/entries', null, tokenA)
assert('删除日记成功', del.ok === true && afterDel.data.length === 1)

console.log('== 5. 恋爱瞬间与地图 ==')
const m1 = await http('POST', '/api/moments', {
  content: '西湖边的晚风', mood: 'sweet', location: '杭州西湖', longitude: 120.15, latitude: 30.24, momentDate: '2026-08-20',
}, tokenA)
const m2 = await http('POST', '/api/moments', {
  content: '外滩的夜景真好看', mood: 'happy', location: '上海外滩', longitude: 121.49, latitude: 31.24, momentDate: '2026-08-22',
}, tokenB)
assert('创建两条带坐标瞬间', m1.ok && m2.ok)

const mList = await http('GET', '/api/moments?mood=sweet', null, tokenA)
assert('按心情筛选', mList.data.length === 1 && mList.data[0].content.includes('西湖'))

const mMap = await http('GET', '/api/moments/map', null, tokenA)
assert('地图数据含坐标且按时间升序', mMap.data.length === 2 && mMap.data[0].location === '杭州西湖' && mMap.data[1].location === '上海外滩')

const mUpd = await http('PUT', `/api/moments/${m1.data.id}`, { content: '西湖边的晚风（改）' }, tokenA)
assert('编辑瞬间', mUpd.data.content.includes('（改）'))

console.log('== 6. 情书 ==')
const letter = await http('POST', '/api/letters', { title: '给你', content: '今晚月色真美。', isSecret: true }, tokenA)
assert('写情书', letter.ok)
const lRead = await http('GET', `/api/letters/${letter.data.id}`, null, tokenB)
assert('对方查看后标记已读', lRead.data.is_read === 1)

console.log('== 7. 相册 ==')
const fd1 = new FormData()
fd1.append('file', new Blob([png], { type: 'image/png' }), 'a.png')
const up1 = await http('POST', '/api/upload', fd1, tokenB, true)
const fd2 = new FormData()
fd2.append('file', new Blob([png], { type: 'image/png' }), 'b.png')
const up2 = await http('POST', '/api/upload', fd2, tokenB, true)
const album = await http('POST', '/api/albums', { name: '第一次旅行', description: '杭州' }, tokenA)
assert('创建相册', album.ok)
const ap = await http('POST', `/api/albums/${album.data.id}/photos`, { fileId: up1.data.id, caption: '合影' }, tokenB)
assert('添加照片', ap.ok && ap.data.photos.length === 1)
assert('封面与照片集独立（不自动设封面）', ap.ok && ap.data.cover_url === '')
const ap2 = await http('POST', `/api/albums/${album.data.id}/photos`, { fileId: up2.data.id, caption: '第二张' }, tokenB)
const cover = await http('PUT', `/api/albums/${album.data.id}/cover`, { fileId: up2.data.id }, tokenA)
assert('手动设置封面', cover.ok && String(cover.data.cover_url).startsWith('/media/'))
const delPhoto = await http('DELETE', `/api/albums/${album.data.id}/photos/${ap2.data.photos[1].id}`, null, tokenA)
assert('删除照片', delPhoto.ok && delPhoto.data.photos.length === 1)
const albums = await http('GET', '/api/albums', null, tokenA)
assert('相册列表含照片数', albums.data.length === 1 && albums.data[0].photoCount === 1)

const page1 = await http('GET', `/api/albums/${album.data.id}/photos?offset=0&limit=1`, null, tokenA)
assert('相册照片分页', page1.ok && page1.data.items.length === 1 && page1.data.total === 1)
const updAlbum = await http('PUT', `/api/albums/${album.data.id}`, { name: '第一次旅行（改）', description: '杭州两日' }, tokenA)
assert('修改相册信息', updAlbum.data.name.includes('改') && updAlbum.data.description === '杭州两日')
const story = await http('PUT', `/api/albums/${album.data.id}/photos/${page1.data.items[0].id}`, { caption: '湖边的合影' }, tokenA)
assert('为照片写故事', story.ok && story.data.caption === '湖边的合影')

console.log('== 8. 心愿清单 ==')
const wish = await http('POST', '/api/wishes', { title: '一起看极光', category: 'travel', priority: 2 }, tokenA)
assert('许愿', wish.ok && wish.data.status === 'todo')
const wishMoved = await http('PUT', `/api/wishes/${wish.data.id}/status`, { status: 'doing' }, tokenB)
assert('看板流转 doing', wishMoved.data.status === 'doing')
const wishDone = await http('PUT', `/api/wishes/${wish.data.id}/status`, { status: 'done' }, tokenA)
assert('完成记录完成时间', wishDone.data.status === 'done' && Boolean(wishDone.data.completed_at))
const wishBack = await http('PUT', `/api/wishes/${wish.data.id}/status`, { status: 'doing' }, tokenA)
assert('撤回后清空完成时间', wishBack.data.status === 'doing' && wishBack.data.completed_at == null)

console.log('== 9. 时间胶囊 ==')
const capFuture = await http('POST', '/api/capsules', { title: '给一年后', content: '一年后的我们好吗', unlockDate: '2027-08-24' }, tokenA)
const capPast = await http('POST', '/api/capsules', { title: '昨日', content: '已经可以打开了', unlockDate: '2026-08-01' }, tokenB)
assert('密封两枚胶囊', capFuture.ok && capPast.ok)
const caps = await http('GET', '/api/capsules', null, tokenA)
const f = caps.data.find((c) => c.title === '给一年后')
const p = caps.data.find((c) => c.title === '昨日')
assert('未到期内容被遮蔽', f && f.isUnlocked === 0 && f.content.includes('***'))
assert('已到期内容可见', p && p.isUnlocked === 1 && p.content === '已经可以打开了')

console.log('== 10. 纪念日 ==')
const localNow = new Date()
const localToday = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`
const ann = await http('POST', '/api/anniversaries', { title: '在一起', type: 'together', date: localToday }, tokenA)
assert('添加纪念日且今天纪念', ann.ok && ann.data.isToday === true)

console.log('== 11. 分享链接 ==')
const share = await http('POST', '/api/share/create', { password: 'honey', expireDays: 7 }, tokenA)
assert('创建带密码分享', share.ok && share.data.token)
const noPw = await http('GET', `/api/public/share/${share.data.token}`)
assert('无密码访问被拒并提示需要密码', noPw.ok === false && noPw.needPassword === true)
const withPw = await http('GET', `/api/public/share/${share.data.token}?password=honey`)
assert('带密码可访问', withPw.ok && withPw.data.moments.length === 2 && withPw.data.entries.length === 1)
const shareCur = await http('GET', '/api/share/current', null, tokenA)
assert('当前分享信息', shareCur.data.hasPassword === true && shareCur.data.viewCount === 1)
const shareOff = await http('DELETE', '/api/share/current', null, tokenA)
const afterOff = await http('GET', `/api/public/share/${share.data.token}`)
assert('停用后访问 404', afterOff.ok === false)

console.log('== 12. 聚合 / 日历 ==')
const dash = await http('GET', '/api/dashboard', null, tokenA)
assert('Dashboard 聚合', dash.ok && dash.data.stats.moments === 2 && dash.data.partner?.username === 'bob')
const tree = await http('GET', '/api/tree/state', null, tokenA)
assert('恋爱树状态', tree.ok && typeof tree.data.progress === 'number' && tree.data.total >= 5)
const cal = await http('GET', `/api/entries/calendar?year=${localNow.getFullYear()}&month=${localNow.getMonth() + 1}`, null, tokenA)
assert('日记日历按月份', cal.ok && cal.data.length === 1)

const tl = await http('GET', '/api/timeline', null, tokenA)
const kinds = new Set(tl.data.events.map((e) => e.kind))
assert('时光时间线聚合多种类型且倒序', tl.ok && kinds.has('entry') && kinds.has('moment') && kinds.has('letter')
  && tl.data.events[0].ts >= tl.data.events[tl.data.events.length - 1].ts)

console.log('== 13. 评论 ==')
const comments0 = await http('GET', `/api/comments?targetType=entry&targetId=${solo.data.id}`, null, tokenA)
assert('新日记暂无评论', comments0.ok && comments0.data.length === 0)

const c1 = await http('POST', '/api/comments', { targetType: 'entry', targetId: solo.data.id, content: '好温柔的雨声' }, tokenB)
assert('B 评论 A 的日记', c1.ok && c1.data.author?.username === 'bob' && c1.data.target_type === 'entry')
const c2 = await http('POST', '/api/comments', { targetType: 'entry', targetId: solo.data.id, content: '贴贴' }, tokenA)
assert('A 追加评论', c2.ok === true)

const comments1 = await http('GET', `/api/comments?targetType=entry&targetId=${solo.data.id}`, null, tokenA)
assert('评论按时间升序返回', comments1.data.length === 2 && comments1.data[0].id === c1.data.id)

const mComment = await http('POST', '/api/comments', { targetType: 'moment', targetId: m1.data.id, content: '这里好美' }, tokenB)
assert('B 评论恋爱瞬间', mComment.ok && mComment.data.target_type === 'moment')

const reply1 = await http('POST', '/api/comments',
  { targetType: 'entry', targetId: solo.data.id, content: '我也这么觉得', parentId: c1.data.id }, tokenA)
assert('A 回复 B 的顶层评论', reply1.ok && reply1.data.parent_id === c1.data.id
  && reply1.data.reply_to_user_id === regB.data.me.id && reply1.data.reply_to_comment_id === c1.data.id)
const reply2 = await http('POST', '/api/comments',
  { targetType: 'entry', targetId: solo.data.id, content: '抱住', parentId: reply1.data.id }, tokenB)
assert('回复的回复扁平化到顶层并记录精确目标', reply2.ok && reply2.data.parent_id === c1.data.id
  && reply2.data.reply_to_user_id === regA.data.me.id && reply2.data.reply_to_comment_id === reply1.data.id)

const badType = await http('POST', '/api/comments', { targetType: 'letter', targetId: 'x', content: 'hi' }, tokenA)
assert('非法目标类型被拒绝', badType.ok === false)
const emptyContent = await http('POST', '/api/comments', { targetType: 'entry', targetId: solo.data.id, content: '   ' }, tokenA)
assert('空白评论被拒绝', emptyContent.ok === false)
const missingTarget = await http('GET', '/api/comments?targetType=entry&targetId=e_not_exist', null, tokenA)
assert('目标不存在返回失败', missingTarget.ok === false)
const crossParent = await http('POST', '/api/comments',
  { targetType: 'entry', targetId: solo.data.id, content: 'x', parentId: mComment.data.id }, tokenA)
assert('父评论不属于该目标被拒绝', crossParent.ok === false)
const missingParent = await http('POST', '/api/comments',
  { targetType: 'entry', targetId: solo.data.id, content: 'x', parentId: 'cm_not_exist' }, tokenA)
assert('父评论不存在被拒绝', missingParent.ok === false)

const dupKey = 'smoke-comment-replay'
const dup1 = await http('POST', '/api/comments', { targetType: 'entry', targetId: solo.data.id, content: '幂等评论' }, tokenA, false, dupKey)
const dup2 = await http('POST', '/api/comments', { targetType: 'entry', targetId: solo.data.id, content: '幂等评论' }, tokenA, false, dupKey)
assert('同 Idempotency-Key 重放返回同一条评论', dup1.ok && dup2.ok && dup1.data.id === dup2.data.id)

const delOther = await http('DELETE', `/api/comments/${c1.data.id}`, null, tokenA)
assert('不能删除伴侣的评论', delOther.ok === false)
const delRoot = await http('DELETE', `/api/comments/${c1.data.id}`, null, tokenB)
assert('有回复的评论删除后墓碑化', delRoot.ok && delRoot.data.tombstoned === true)

const afterTomb = await http('GET', `/api/comments?targetType=entry&targetId=${solo.data.id}`, null, tokenA)
const tomb = afterTomb.data.find((c) => c.id === c1.data.id)
assert('墓碑保留且正文清空', tomb && tomb.deleted_at && tomb.content === '')
assert('墓碑下的回复仍可见', afterTomb.data.some((c) => c.id === reply1.data.id)
  && afterTomb.data.some((c) => c.id === reply2.data.id))

const replyToTomb = await http('POST', '/api/comments',
  { targetType: 'entry', targetId: solo.data.id, content: 'x', parentId: c1.data.id }, tokenA)
assert('墓碑评论不可回复', replyToTomb.ok === false)

const delPlain = await http('DELETE', `/api/comments/${c2.data.id}`, null, tokenA)
assert('无回复的评论物理删除', delPlain.ok && delPlain.data.tombstoned === false)
const delReply = await http('DELETE', `/api/comments/${reply1.data.id}`, null, tokenA)
assert('被引用的回复删除后墓碑化', delReply.ok && delReply.data.tombstoned === true)

const comments2 = await http('GET', `/api/comments?targetType=entry&targetId=${solo.data.id}`, null, tokenA)
assert('删除后列表状态正确', comments2.data.length === 4
  && comments2.data.some((c) => c.id === c1.data.id && c.deleted_at && c.content === '')
  && comments2.data.some((c) => c.id === dup1.data.id)
  && comments2.data.some((c) => c.id === reply1.data.id && c.deleted_at && c.content === '')
  && comments2.data.some((c) => c.id === reply2.data.id)
  && !comments2.data.some((c) => c.id === c2.data.id))

const tempMoment = await http('POST', '/api/moments', { content: '待删除的瞬间' }, tokenA)
await http('POST', '/api/comments', { targetType: 'moment', targetId: tempMoment.data.id, content: '随瞬间一起消失' }, tokenB)
const cascadeDel = await http('DELETE', `/api/moments/${tempMoment.data.id}`, null, tokenA)
const cascadeList = await http('GET', `/api/comments?targetType=moment&targetId=${tempMoment.data.id}`, null, tokenA)
assert('瞬间删除后评论目标不可达', cascadeDel.ok === true && cascadeList.ok === false)

console.log('== 14. 小本本（关怀档案 / 规矩 / 置顶） ==')
// 1. 新建过敏档案（severe），字段正确，subject 默认伴侣
const nbAllergy = await http('POST', '/api/care/items', { category: 'allergy', title: '芒果过敏', content: '吃完嘴唇发痒', severity: 'severe' }, tokenA)
assert('新建过敏档案成功', nbAllergy.ok && nbAllergy.data.category === 'allergy' && nbAllergy.data.severity === 'severe')
assert('档案字段正确', nbAllergy.ok && nbAllergy.data.title === '芒果过敏' && nbAllergy.data.content === '吃完嘴唇发痒'
  && nbAllergy.data.author_id === regA.data.me.id && nbAllergy.data.subject_id === regB.data.me.id && nbAllergy.data.pin_scope === null)
assert('subject 默认伴侣', nbAllergy.data.subject_id === regB.data.me.id)

// 2. 非法 category
const nbBadCat = await http('POST', '/api/care/items', { category: 'nope', title: 'x' }, tokenA)
assert('非法 category 被拒绝', nbBadCat.ok === false && nbBadCat.error?.code === 'INVALID_CARE_CATEGORY')

// 3. 例假 end < start
const nbBadPeriod = await http('POST', '/api/care/items', { category: 'period', title: '例假', startDate: '2026-09-05', endDate: '2026-09-01' }, tokenA)
assert('例假 end < start 被拒绝', nbBadPeriod.ok === false && nbBadPeriod.error?.code === 'INVALID_PERIOD_RANGE')

// 4. 两条相隔 28 天的例假记录 → 预测
const nbP1 = await http('POST', '/api/care/items', { category: 'period', title: '例假一', startDate: '2026-09-01', endDate: '2026-09-05', cycleDays: 28 }, tokenA)
const nbP2 = await http('POST', '/api/care/items', { category: 'period', title: '例假二', startDate: '2026-09-29', endDate: '2026-10-03', cycleDays: 28 }, tokenA)
assert('创建两条例假记录', nbP1.ok && nbP2.ok)
const nbSummary = await http('GET', '/api/care/period/summary', null, tokenA)
const nbPs = nbSummary.ok ? nbSummary.data.subjects.find((s) => s.subject.id === regB.data.me.id) : null
assert('例假预测 avgCycle=28', nbPs && nbPs.avgCycle === 28, JSON.stringify(nbSummary))
assert('例假预测 nextStart=后者+28', nbPs && nbPs.nextStart === '2026-10-27', `got=${nbPs?.nextStart}`)
assert('例假预测 durationDays=5', nbPs && nbPs.durationDays === 5, `got=${nbPs?.durationDays}`)
assert('例假预测来源=history', nbPs && nbPs.cycleSource === 'history', `got=${nbPs?.cycleSource}`)
assert('例假预测波动=0', nbPs && nbPs.variationDays === 0, `got=${nbPs?.variationDays}`)

// 4.1 智能推算：补一条 26 天后的记录 → 近期加权 + 波动范围
const nbP3 = await http('POST', '/api/care/items', { category: 'period', title: '例假三', startDate: '2026-10-25', endDate: '2026-10-29' }, tokenA)
const nbSummary2 = await http('GET', '/api/care/period/summary', null, tokenA)
const nbPs2 = nbSummary2.ok ? nbSummary2.data.subjects.find((s) => s.subject.id === regB.data.me.id) : null
assert('近期周期线性加权', nbPs2 && nbPs2.avgCycle === 27, `got=${nbPs2?.avgCycle}`)
assert('波动范围=1 天', nbPs2 && nbPs2.variationDays === 1, `got=${nbPs2?.variationDays}`)

// 4.2 无周期数据时智能回退：默认 28 → 填写后按填写值
const nbSelf = await http('POST', '/api/care/items', { category: 'period', title: '自我记录', subjectId: regA.data.me.id, startDate: '2026-08-01' }, tokenA)
const nbSummaryA = await http('GET', '/api/care/period/summary', null, tokenA)
const nbPsA = nbSummaryA.ok ? nbSummaryA.data.subjects.find((s) => s.subject.id === regA.data.me.id) : null
assert('无周期数据回退默认 28 天', nbPsA && nbPsA.avgCycle === 28 && nbPsA.cycleSource === 'default', JSON.stringify(nbPsA))
const nbSelfSet = await http('PUT', `/api/care/items/${nbSelf.data.id}`, { cycleDays: 30 }, tokenA)
const nbSummaryA2 = await http('GET', '/api/care/period/summary', null, tokenA)
const nbPsA2 = nbSummaryA2.ok ? nbSummaryA2.data.subjects.find((s) => s.subject.id === regA.data.me.id) : null
assert('填写周期后按填写值估算', nbPsA2 && nbPsA2.avgCycle === 30 && nbPsA2.cycleSource === 'setting', JSON.stringify(nbPsA2))

// 4.3 性别：可选填、非法拒绝；一方填写后对方自动同步为相反性别；例假未填对象时默认女性一方
const nbGenderBad = await http('PUT', '/api/users/me', { gender: 'x' }, tokenA)
assert('非法性别被拒绝', nbGenderBad.ok === false)
const nbGenderA = await http('PUT', '/api/users/me', { gender: 'female' }, tokenA)
assert('A 设置性别为女', nbGenderA.ok && nbGenderA.data.gender === 'female')
const nbMeB = await http('GET', '/api/auth/me', null, tokenB)
assert('一方填写后对方自动为男', nbMeB.ok && nbMeB.data.me.gender === 'male' && nbMeB.data.partner.gender === 'female')
const nbGenderB = await http('PUT', '/api/users/me', { gender: 'female' }, tokenB)
assert('B 改设女覆盖自己', nbGenderB.ok && nbGenderB.data.gender === 'female')
const nbMeA = await http('GET', '/api/auth/me', null, tokenA)
assert('另一方自动同步为男', nbMeA.ok && nbMeA.data.me.gender === 'male' && nbMeA.data.partner.gender === 'female')
const nbAutoSubject = await http('POST', '/api/care/items', { category: 'period', title: '智能对象', startDate: '2026-11-01' }, tokenA)
assert('例假未填对象时默认女性一方', nbAutoSubject.ok && nbAutoSubject.data.subject_id === regB.data.me.id,
  `got=${nbAutoSubject.data?.subject_id}`)

// 5. 伴侣可见 A 创建的档案
const nbCareListB = await http('GET', '/api/care/items', null, tokenB)
assert('伴侣可见 A 创建的档案', nbCareListB.ok && nbCareListB.data.some((i) => i.id === nbAllergy.data.id))

// 6. A 建规矩
const nbRule1 = await http('POST', '/api/rules', { type: 'rule', title: '每天说晚安', content: '睡前互道晚安' }, tokenA)
assert('A 建规矩 agreedIds=[A]', nbRule1.ok && Array.isArray(nbRule1.data.agreedIds)
  && nbRule1.data.agreedIds.length === 1 && nbRule1.data.agreedIds[0] === regA.data.me.id)
assert('A 建规矩 effective=false', nbRule1.data.effective === false)
const nbPendingB = await http('GET', '/api/rules/pending/count', null, tokenB)
assert('B 待认同数=1', nbPendingB.ok && nbPendingB.data.count === 1)

// 7. B 认同
const nbAgree = await http('PUT', `/api/rules/${nbRule1.data.id}/agree`, null, tokenB)
assert('B 认同后 effective=true', nbAgree.ok && nbAgree.data.effective === true && nbAgree.data.agreedIds.length === 2)
const nbPendingB2 = await http('GET', '/api/rules/pending/count', null, tokenB)
assert('B 认同后待认同数=0', nbPendingB2.ok && nbPendingB2.data.count === 0)

// 8. A 编辑标题 → 重置认同
const nbEditRule = await http('PUT', `/api/rules/${nbRule1.data.id}`, { type: 'rule', title: '每天说晚安（改）', content: '睡前互道晚安' }, tokenA)
assert('A 编辑标题重置认同', nbEditRule.ok && nbEditRule.data.effective === false
  && nbEditRule.data.agreedIds.length === 1 && nbEditRule.data.agreedIds[0] === regA.data.me.id)

// 9. 置顶 care 为 global
const nbPinCare = await http('PUT', '/api/pins', { targetType: 'care', targetId: nbAllergy.data.id, scope: 'global' }, tokenA)
assert('置顶 care 为 global', nbPinCare.ok && nbPinCare.data.scope === 'global')
const nbGlobals = await http('GET', '/api/pins/global', null, tokenA)
assert('global 列表含该 care', nbGlobals.ok && nbGlobals.data.items.some((it) => it.targetId === nbAllergy.data.id && it.targetType === 'care'))
const nbCareListA = await http('GET', '/api/care/items', null, tokenA)
assert('care 列表置顶项排第一', nbCareListA.data[0].id === nbAllergy.data.id && nbCareListA.data[0].pin_scope === 'global')

// 10. 取消置顶
const nbUnpin = await http('PUT', '/api/pins', { targetType: 'care', targetId: nbAllergy.data.id, scope: 'none' }, tokenA)
const nbGlobals2 = await http('GET', '/api/pins/global', null, tokenA)
assert('取消置顶后 global 不含', nbUnpin.ok && !nbGlobals2.data.items.some((it) => it.targetId === nbAllergy.data.id))

// 11. 置顶不存在的目标
const nbPinMissing = await http('PUT', '/api/pins', { targetType: 'care', targetId: 'care_not_exist', scope: 'global' }, tokenA)
assert('置顶不存在目标被拒绝', nbPinMissing.ok === false && nbPinMissing.error?.code === 'PIN_TARGET_NOT_FOUND')

// 12. 重新置顶后删除 → 置顶清理
await http('PUT', '/api/pins', { targetType: 'care', targetId: nbAllergy.data.id, scope: 'global' }, tokenA)
const nbDelCare = await http('DELETE', `/api/care/items/${nbAllergy.data.id}`, null, tokenA)
const nbGlobals3 = await http('GET', '/api/pins/global', null, tokenA)
assert('删除档案后 global 不含（置顶清理）', nbDelCare.ok === true && !nbGlobals3.data.items.some((it) => it.targetId === nbAllergy.data.id))

console.log('== 15. 导出时光机 ==')
const exp = await fetch(BASE + '/api/export')
const buf = await exp.arrayBuffer()
assert('导出 zip 非空', exp.status === 200 && buf.byteLength > 0, `bytes=${buf.byteLength}`)

console.log(failed ? `\n✗ ${failed} 项失败` : '\n✓ 冒烟测试全部通过')
process.exit(failed ? 1 : 0)
