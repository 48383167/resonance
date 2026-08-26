<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { currentTheme } from '../stores/theme'

// 环境底片背景：时间/天气 → 渐变 + WebGL 风格粒子（Canvas 模拟）
const props = defineProps({
  colors: { type: Array, default: () => ['#03061a', '#0b1d3a', '#1a2a52'] },
  weatherCode: { type: [Number, null], default: null },
  opacity: { type: Number, default: 1 },
})

const canvasRef = ref(null)
let raf = 0
let particles = []

function kindOf(code) {
  if (code == null || code === 0) return 'sparkle'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 95) return 'thunder'
  return 'sparkle'
}

function spawn(canvas, kind) {
  particles = []
  const count = kind === 'rain' ? 90 : kind === 'snow' ? 50 : 70
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: kind === 'snow' ? 1.5 + Math.random() * 2.5 : kind === 'rain' ? 1 : 0.6 + Math.random() * 1.8,
      vx: kind === 'fog' ? 0.3 + Math.random() * 0.5 : kind === 'rain' ? 0 : (Math.random() - 0.5) * 0.4,
      vy: kind === 'rain' ? 6 + Math.random() * 8 : kind === 'snow' ? 0.6 + Math.random() * 0.8 : 0.15 + Math.random() * 0.3,
      alpha: 0.3 + Math.random() * 0.5,
      drift: Math.random() * Math.PI * 2,
    })
  }
}

let lastFlash = 0
function draw(ctx, w, h, kind) {
  ctx.clearRect(0, 0, w, h)
  if (kind === 'thunder' && Date.now() - lastFlash > 7000 + Math.random() * 6000) {
    lastFlash = Date.now()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillRect(0, 0, w, h)
  }
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.drift += 0.02
    if (kind === 'fog') p.x += Math.sin(p.drift) * 0.4
    if (kind === 'sparkle') p.x += Math.sin(p.drift) * 0.3
    if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w }
    if (p.x > w + 10) p.x = -10
    if (p.x < -10) p.x = w + 10
    ctx.beginPath()
    if (kind === 'rain') {
      ctx.strokeStyle = rgba(currentTheme.secondaryColor, p.alpha * 0.7)
      ctx.lineWidth = 1
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - 3, p.y - 10)
      ctx.stroke()
    } else {
      ctx.fillStyle = rgba(currentTheme.primaryColor, p.alpha)
      ctx.shadowBlur = 12
      ctx.shadowColor = rgba(currentTheme.primaryColor, 0.8)
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function rgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function loop() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = (canvas.width = canvas.clientWidth)
  const h = (canvas.height = canvas.clientHeight)
  draw(ctx, w, h, kindOf(props.weatherCode))
  raf = requestAnimationFrame(loop)
}

watch(() => props.weatherCode, () => {
  const canvas = canvasRef.value
  if (canvas) spawn(canvas, kindOf(props.weatherCode))
})

onMounted(() => {
  const canvas = canvasRef.value
  spawn(canvas, kindOf(props.weatherCode))
  loop()
  window.addEventListener('resize', () => spawn(canvas, kindOf(props.weatherCode)))
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="fixed inset-0 -z-10 overflow-hidden" :style="{ opacity }">
    <div class="absolute inset-0" :style="{
      background: `linear-gradient(160deg, ${colors[0]}, ${colors[1]} 55%, ${colors[2]})`,
    }" />
    <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" />
    <div class="theme-aura pointer-events-none absolute inset-0" />
    <div class="theme-vignette absolute inset-0" />
  </div>
</template>
