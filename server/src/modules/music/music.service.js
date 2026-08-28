// 网易云随机音乐接口：每次请求返回一首随机歌曲。
const RANDOM_MUSIC_URL = 'https://free.wqwlkj.cn/wqwlapi/wyy_random.php?type=json'

async function fetchRandomTrack() {
  const resp = await fetch(RANDOM_MUSIC_URL, { signal: AbortSignal.timeout(10000) })
  if (!resp.ok) throw new Error(`网易云随机音乐返回 ${resp.status}`)

  const json = await resp.json()
  const data = json?.data
  if (String(json?.code) !== '1' || !data?.url) throw new Error('网易云随机音乐返回数据无效')

  return {
    id: String(data.id || data.url),
    name: data.name || '未知歌曲',
    artist: data.artistsname || '未知歌手',
    album: data.alname || '',
    audio: data.url,
    image: data.picurl || json.coverImgUrl || '',
  }
}

export async function getTracks() {
  try {
    return { tracks: [await fetchRandomTrack()] }
  } catch {
    return { error: '获取音乐失败：网易云随机音乐暂时不可用' }
  }
}
