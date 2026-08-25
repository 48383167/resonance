// 端到端冒烟测试：注册/登录 → 日记 → 全模块 → 分享 → 导出
// 前置：服务端已启动（建议 RESONANCE_DATA_DIR 指向临时目录，避免污染真实数据）
const BASE = process.env.RESONANCE_BASE || 'http://localhost:4000'
let failed = 0

function assert(name, cond, extra = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else { failed++; console.error(`  ✗ ${name} ${extra}`) }
}

async function http(method, url, body, token, isForm) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
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

console.log('== 2. 日记 ==')
const solo = await http('POST', '/api/entries/solo',
  { title: '夜航', content: '窗外的雨声像你说话的语气。', typingSpeed: 58, deleteCount: 3, pauseDuration: 1200, weatherCode: 61, timeColorHex: '#0b1d3a', media: ['/media/a.jpg', '/media/b.mp4'] }, tokenA)
assert('写日记成功（含情绪墨水与附件）', solo.ok === true && solo.data.contents.length === 1
  && solo.data.contents[0].typing_speed === 58 && solo.data.media.length === 2)

const vis = await http('PATCH', `/api/entries/${solo.data.id}/visibility`, { isPublic: true }, tokenA)
assert('切换公开成功', Number(vis.data.is_public) === 1)

const obs = await http('GET', '/api/public/observatory')
assert('观测台仅见公开篇', obs.data.entries.length === 1 && obs.data.entries[0].id === solo.data.id)

const temp = await http('POST', '/api/entries/solo', { title: '临时', content: '待删除', typingSpeed: 10 }, tokenA)
const del = await http('DELETE', `/api/entries/${temp.data.id}`, null, tokenA)
const afterDel = await http('GET', '/api/entries', null, tokenA)
assert('删除日记成功', del.ok === true && afterDel.data.length === 1)

console.log('== 3. 恋爱瞬间与地图 ==')
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

console.log('== 4. 情书 ==')
const letter = await http('POST', '/api/letters', { title: '给你', content: '今晚月色真美。', isSecret: true }, tokenA)
assert('写情书', letter.ok)
const lRead = await http('GET', `/api/letters/${letter.data.id}`, null, tokenB)
assert('对方查看后标记已读', lRead.data.is_read === 1)

console.log('== 5. 相册 ==')
const album = await http('POST', '/api/albums', { name: '第一次旅行', description: '杭州' }, tokenA)
assert('创建相册', album.ok)
const ap = await http('POST', `/api/albums/${album.data.id}/photos`, { url: '/media/fake.jpg', caption: '合影' }, tokenB)
assert('添加照片并自动设为封面', ap.ok && ap.data.cover_url === '/media/fake.jpg' && ap.data.photos.length === 1)
const ap2 = await http('POST', `/api/albums/${album.data.id}/photos`, { url: '/media/fake2.jpg', caption: '第二张' }, tokenB)
const cover = await http('PUT', `/api/albums/${album.data.id}/cover`, { url: '/media/fake2.jpg' }, tokenA)
assert('手动设置封面', cover.ok && cover.data.cover_url === '/media/fake2.jpg')
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

console.log('== 6. 心愿清单 ==')
const wish = await http('POST', '/api/wishes', { title: '一起看极光', category: 'travel', priority: 2 }, tokenA)
assert('许愿', wish.ok && wish.data.status === 'todo')
const wishMoved = await http('PUT', `/api/wishes/${wish.data.id}/status`, { status: 'doing' }, tokenB)
assert('看板流转 doing', wishMoved.data.status === 'doing')
const wishDone = await http('PUT', `/api/wishes/${wish.data.id}/status`, { status: 'done' }, tokenA)
assert('完成记录完成时间', wishDone.data.status === 'done' && Boolean(wishDone.data.completed_at))
const wishBack = await http('PUT', `/api/wishes/${wish.data.id}/status`, { status: 'doing' }, tokenA)
assert('撤回后清空完成时间', wishBack.data.status === 'doing' && wishBack.data.completed_at == null)

console.log('== 7. 时间胶囊 ==')
const capFuture = await http('POST', '/api/capsules', { title: '给一年后', content: '一年后的我们好吗', unlockDate: '2027-08-24' }, tokenA)
const capPast = await http('POST', '/api/capsules', { title: '昨日', content: '已经可以打开了', unlockDate: '2026-08-01' }, tokenB)
assert('密封两枚胶囊', capFuture.ok && capPast.ok)
const caps = await http('GET', '/api/capsules', null, tokenA)
const f = caps.data.find((c) => c.title === '给一年后')
const p = caps.data.find((c) => c.title === '昨日')
assert('未到期内容被遮蔽', f && f.isUnlocked === 0 && f.content.includes('***'))
assert('已到期内容可见', p && p.isUnlocked === 1 && p.content === '已经可以打开了')

console.log('== 8. 纪念日 ==')
const localNow = new Date()
const localToday = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`
const ann = await http('POST', '/api/anniversaries', { title: '在一起', type: 'together', date: localToday }, tokenA)
assert('添加纪念日且今天纪念', ann.ok && ann.data.isToday === true)

console.log('== 9. 分享链接 ==')
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

console.log('== 10. 上传 / 聚合 / 日历 ==')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const fd = new FormData()
fd.append('file', new Blob([png], { type: 'image/png' }), 't.png')
const up = await http('POST', '/api/upload', fd, tokenA, true)
assert('图片上传返回 /media URL', up.ok && String(up.data.url).startsWith('/media/'))

const dash = await http('GET', '/api/dashboard', null, tokenA)
assert('Dashboard 聚合', dash.ok && dash.data.stats.moments === 2 && dash.data.partner?.username === 'bob')
const tree = await http('GET', '/api/tree/state', null, tokenA)
assert('恋爱树状态', tree.ok && typeof tree.data.progress === 'number' && tree.data.total >= 5)
const cal = await http('GET', '/api/entries/calendar?year=2026&month=8', null, tokenA)
assert('日记日历按月份', cal.ok && cal.data.length === 1)

const tl = await http('GET', '/api/timeline', null, tokenA)
const kinds = new Set(tl.data.events.map((e) => e.kind))
assert('时光时间线聚合多种类型且倒序', tl.ok && kinds.has('entry') && kinds.has('moment') && kinds.has('letter')
  && tl.data.events[0].ts >= tl.data.events[tl.data.events.length - 1].ts)

console.log('== 11. 导出时光机 ==')
const exp = await fetch(BASE + '/api/export')
const buf = await exp.arrayBuffer()
assert('导出 zip 非空', exp.status === 200 && buf.byteLength > 0, `bytes=${buf.byteLength}`)

console.log(failed ? `\n✗ ${failed} 项失败` : '\n✓ 冒烟测试全部通过')
process.exit(failed ? 1 : 0)
