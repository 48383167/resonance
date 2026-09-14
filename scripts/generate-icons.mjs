// 生成 PWA 图标 PNG（无第三方依赖：node:zlib + 手写 PNG 编码）
// 用法：node scripts/generate-icons.mjs
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'client', 'public')

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// 深色底 + 渐变圆角方块 + 双音符；内容居中 75%，可同时用作 maskable 图标
function renderIcon(size) {
  const ss = 3 // 超采样倍数，用于抗锯齿
  const S = size * ss
  const pixels = Buffer.alloc(S * S * 4)
  const bg = hexToRgb('#070a18')
  const accent1 = hexToRgb('#d8a7ff')
  const accent2 = hexToRgb('#7ec8ff')
  const ink = hexToRgb('#1a1030')

  const inset = S * 0.125
  const radius = S * 0.22
  const x0 = inset
  const y0 = inset
  const x1 = S - inset
  const y1 = S - inset

  const head1 = { x: 0.4 * S, y: 0.62 * S, r: 0.085 * S }
  const head2 = { x: 0.6 * S, y: 0.58 * S, r: 0.068 * S }
  const stem1 = { x: 0.4 * S, w: 0.045 * S, top: 0.3 * S, bottom: 0.62 * S }
  const stem2 = { x: 0.6 * S, w: 0.038 * S, top: 0.3 * S, bottom: 0.58 * S }
  const beam = { ax: 0.4 * S, ay: 0.315 * S, bx: 0.62 * S, by: 0.285 * S, r: 0.03 * S }

  const inRoundRect = (x, y) => {
    const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius))
    const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius))
    return dx * dx + dy * dy <= radius * radius
  }
  const inCircle = (x, y, c) => {
    const dx = x - c.x
    const dy = y - c.y
    return dx * dx + dy * dy <= c.r * c.r
  }
  const inRect = (x, y, r) => x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.top && y <= r.bottom
  const inBeam = (x, y) => {
    const vx = beam.bx - beam.ax
    const vy = beam.by - beam.ay
    const t = Math.max(0, Math.min(1, ((x - beam.ax) * vx + (y - beam.ay) * vy) / (vx * vx + vy * vy)))
    const dx = x - (beam.ax + t * vx)
    const dy = y - (beam.ay + t * vy)
    return dx * dx + dy * dy <= beam.r * beam.r
  }

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      let r = bg.r
      let g = bg.g
      let b = bg.b
      if (inRoundRect(x, y)) {
        const t = (x + y) / (2 * S)
        r = accent1.r + (accent2.r - accent1.r) * t
        g = accent1.g + (accent2.g - accent1.g) * t
        b = accent1.b + (accent2.b - accent1.b) * t
        if (inCircle(x, y, head1) || inCircle(x, y, head2) || inRect(x, y, stem1) || inRect(x, y, stem2) || inBeam(x, y)) {
          r = ink.r
          g = ink.g
          b = ink.b
        }
      }
      pixels[i] = Math.round(r)
      pixels[i + 1] = Math.round(g)
      pixels[i + 2] = Math.round(b)
      pixels[i + 3] = 255
    }
  }

  const out = Buffer.alloc(size * size * 4)
  const n = ss * ss
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const i = ((y * ss + sy) * S + (x * ss + sx)) * 4
          r += pixels[i]
          g += pixels[i + 1]
          b += pixels[i + 2]
        }
      }
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = 255
    }
  }
  return encodePng(size, size, out)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
  fs.writeFileSync(path.join(OUT_DIR, name), renderIcon(size))
  console.log(`generated client/public/${name}`)
}
