// —— 环境底片 (Sensory Snapshot)：时间 / 天气 / 音量 → 渐变与粒子背景 ——

// 各时段三色渐变（按小时区间映射）
const PALETTES = {
  night: ['#03061a', '#0b1d3a', '#1a2a52'],     // 深夜 20-4
  dawn: ['#1b1035', '#5a2a5c', '#ff9e7d'],      // 黎明 5-7
  morning: ['#2a1a52', '#7a5ba8', '#ffd9a0'],   // 清晨 8-10
  noon: ['#1a3a6b', '#5a86c9', '#fff3c4'],      // 正午 11-13
  afternoon: ['#203a6b', '#7a6a9f', '#ffc97a'], // 午后 14-16
  dusk: ['#2b1a3a', '#7a4a8f', '#e8835a'],      // 黄昏 17-19
}

function paletteForHour(hour) {
  if (hour >= 20 || hour < 5) return PALETTES.night
  if (hour < 8) return PALETTES.dawn
  if (hour < 11) return PALETTES.morning
  if (hour < 14) return PALETTES.noon
  if (hour < 17) return PALETTES.afternoon
  return PALETTES.dusk
}

// 时间 → 映射色（开发手册：深夜蓝、雨天灰绿等）
export function timeColorHex(hour = new Date().getHours()) {
  return paletteForHour(hour)[1]
}

export function paletteFor(hour, weatherCode) {
  const [c1, c2, c3] = paletteForHour(hour)
  const tint = weatherTint(weatherCode)
  if (!tint) return [c1, c2, c3]
  return [c1, blend(c2, tint.color, tint.amount), blend(c3, tint.color, tint.amount)]
}

function weatherTint(code) {
  if (code == null) return null
  if (code === 0) return null // 晴：保持原色
  if (code >= 51 && code <= 67) return { color: '#3a4a44', amount: 0.55 } // 雨：灰绿
  if (code >= 71 && code <= 77) return { color: '#8fb4d8', amount: 0.4 } // 雪：淡蓝
  if (code >= 95) return { color: '#5a4a7a', amount: 0.5 } // 雷暴：紫灰
  if (code === 45 || code === 48) return { color: '#6a6a78', amount: 0.45 } // 雾
  return { color: '#7a7a8a', amount: 0.3 } // 多云等
}

function blend(hex, hex2, amount) {
  const [r, g, b] = hexToRgb(hex)
  const [r2, g2, b2] = hexToRgb(hex2)
  const mix = (a, c) => Math.round(a + (c - a) * amount)
  return rgbToHex(mix(r, r2), mix(g, g2), mix(b, b2))
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

// 天气采集（Open-Meteo，无需 API Key；失败则返回 null）
export async function fetchWeather() {
  try {
    const coords = await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), () => resolve(null), { timeout: 4000 })
    })
    const lat = coords?.latitude ?? 39.9
    const lon = coords?.longitude ?? 116.4
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code`)
    const json = await res.json()
    return { code: json.current?.weather_code ?? null, label: weatherLabel(json.current?.weather_code) }
  } catch {
    return { code: null, label: null }
  }
}

export function weatherLabel(code) {
  if (code == null) return '未知天气'
  if (code === 0) return '晴'
  if (code <= 2) return '多云'
  if (code === 3) return '阴'
  if (code === 45 || code === 48) return '雾'
  if (code >= 51 && code <= 57) return '毛毛雨'
  if (code >= 61 && code <= 65) return '雨'
  if (code >= 66 && code <= 67) return '冻雨'
  if (code >= 71 && code <= 77) return '雪'
  if (code >= 80 && code <= 82) return '阵雨'
  if (code >= 95) return '雷暴'
  return '天气'
}

// 音量采集：麦克风 RMS → 估算分贝 (0-100)；拒绝授权则返回 null
export async function captureNoise() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    await new Promise((r) => setTimeout(r, 350))
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (const v of data) {
      const d = (v - 128) / 128
      sum += d * d
    }
    const db = Math.max(0, Math.min(100, Math.round(20 * Math.log10(Math.sqrt(sum / data.length) + 1e-6) + 90)))
    stream.getTracks().forEach((t) => t.stop())
    ctx.close()
    return db
  } catch {
    return null
  }
}
