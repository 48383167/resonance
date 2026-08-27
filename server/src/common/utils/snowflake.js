import crypto from 'node:crypto'

// 雪花 ID（对齐 youth-media 的 SnowflakeIdGenerator）：
// 1 符号位 + 41 时间戳（epoch 2021-03-01）+ 5 数据中心 + 5 工作机 + 12 序列
// 媒体文件 ID 特殊规则：数据中心 = 1（媒体表），工作机 = 文件扩展名码
// 物理文件名 = SHA-256(8字节大端ID) 前 8 字节的 16 进制（防猜测）
// JS 64 位用 BigInt 表示，入库一律存十进制字符串
const START_EPOCH = 1614556800000n // 2021-03-01 00:00:00 UTC
const DATA_CENTER_BITS = 5n
const WORKER_BITS = 5n
const SEQUENCE_BITS = 12n
const WORKER_SHIFT = SEQUENCE_BITS
const DATA_CENTER_SHIFT = SEQUENCE_BITS + WORKER_BITS
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_BITS + DATA_CENTER_BITS
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n
const MAX_WORKER = (1n << WORKER_BITS) - 1n
const MEDIA_DATA_CENTER = 1n

// 扩展名 → 工作机码（沿用 youth-media MediaFileExtensionEnum；m4a 修正为 16）
const EXT_CODE = {
  jpg: 1, jpeg: 1, png: 2, gif: 3, bmp: 4, tiff: 5,
  mp4: 6, avi: 7, mkv: 8, mov: 9, wmv: 10,
  mp3: 11, wav: 12, flac: 13, aac: 14, webp: 15, m4a: 16,
}
// 码 → 规范扩展名（未知码返回 null，扩展名须从 files 表取）
const CODE_EXT = {}
for (const [ext, code] of Object.entries(EXT_CODE)) {
  if (!(code in CODE_EXT)) CODE_EXT[code] = ext === 'jpeg' ? 'jpg' : ext
}

// 未知后缀统一落到码 0（OTHER），扩展名原样保留（存 files 表，不依赖 ID 反推）
export const FALLBACK_CODE = 0
export const FALLBACK_EXT = 'bin'

// 每个工作机码一套生成器状态（Node 单线程，无需锁）
const states = new Map()

// 迁移模式计数器：按 (码, 毫秒) 计数，允许历史时间戳乱序（时钟回拨守卫不适用于历史数据回填）
const migrationCounters = new Map()

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

export function codeOfExt(ext) {
  return EXT_CODE[String(ext || '').toLowerCase()] ?? FALLBACK_CODE
}

// 规范扩展名：已知后缀统一（jpeg→jpg），未知后缀原样保留
export function canonicalExt(name) {
  const ext = extOf(name) || FALLBACK_EXT
  const code = codeOfExt(ext)
  return code === FALLBACK_CODE ? ext : CODE_EXT[code]
}

// 生成下一个 ID（code 即工作机位）
// timestampMs 仅供迁移脚本为旧文件按原上传时间生成 ID 时指定（可乱序、单调性不要求）
export function nextId(code, timestampMs) {
  if (timestampMs != null) {
    const ts = BigInt(Math.max(Number(timestampMs), Number(START_EPOCH)))
    const key = `${code}:${ts}`
    const seq = (migrationCounters.get(key) || 0) + 1
    if (seq > Number(MAX_SEQUENCE)) throw new Error('同一毫秒内 ID 序列耗尽')
    migrationCounters.set(key, seq)
    return (
      ((ts - START_EPOCH) << TIMESTAMP_SHIFT) |
      (MEDIA_DATA_CENTER << DATA_CENTER_SHIFT) |
      (BigInt(code) << WORKER_SHIFT) |
      BigInt(seq)
    )
  }
  let st = states.get(code)
  if (!st) { st = { lastTimestamp: -1n, sequence: 0n }; states.set(code, st) }
  let now = BigInt(Date.now())
  if (now < st.lastTimestamp) {
    throw new Error('时钟回拨，拒绝生成文件 ID')
  }
  if (now === st.lastTimestamp) {
    st.sequence = (st.sequence + 1n) & MAX_SEQUENCE
    if (st.sequence === 0n) {
      while (now <= st.lastTimestamp) { sleepMs(1); now = BigInt(Date.now()) }
    }
  } else {
    st.sequence = 0n
  }
  st.lastTimestamp = now
  return (
    ((now - START_EPOCH) << TIMESTAMP_SHIFT) |
    (MEDIA_DATA_CENTER << DATA_CENTER_SHIFT) |
    (BigInt(code) << WORKER_SHIFT) |
    st.sequence
  )
}

// 为一个上传文件规划 ID：{ id, ext, code }
export function generateFileId(originalName, timestampMs) {
  const ext = canonicalExt(originalName)
  const code = codeOfExt(ext)
  return { id: nextId(code, timestampMs).toString(), ext, code }
}

// 物理文件名：SHA-256(8字节大端ID) 前 8 字节 hex（16 位，防猜测）
export function encryptId(id) {
  const buf = Buffer.allocUnsafe(8)
  buf.writeBigUInt64BE(BigInt(id))
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

const pad2 = (n) => String(n).padStart(2, '0')

// 解析雪花 ID → 时间戳 / 日期路径 / 扩展名码
export function parseId(id) {
  const n = BigInt(id)
  const ts = (n >> TIMESTAMP_SHIFT) + START_EPOCH
  const dc = Number((n >> DATA_CENTER_SHIFT) & MAX_WORKER)
  const worker = Number((n >> WORKER_SHIFT) & MAX_WORKER)
  const sequence = Number(n & MAX_SEQUENCE)
  const d = new Date(Number(ts))
  return {
    id: n.toString(),
    timestamp: ts,
    datePath: `${d.getUTCFullYear()}/${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`,
    dataCenterId: dc,
    workerId: worker,
    extension: CODE_EXT[worker] ?? null,
    sequence,
  }
}

export function datePathOf(id) {
  return parseId(id).datePath
}
