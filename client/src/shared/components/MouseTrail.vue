<template>
  <!-- 捕捉鼠标移动，指针事件穿透，绝对置顶 -->
  <canvas ref="canvasEl" class="pointer-events-none fixed inset-0 z-30 h-full w-full"></canvas>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { currentTheme } from '../../stores/theme'

const canvasEl = ref(null)
let ctx = null
let particles = []
let animationFrameId = null
let dpr = 1
let viewWidth = 0
let viewHeight = 0

// 触屏设备没有鼠标轨迹，移动端与降低动效偏好下完全不启动，避免常驻空转耗电
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
const enabled = !reducedMotion && !coarsePointer

watch(() => [currentTheme.primaryColor, currentTheme.secondaryColor], () => {
  particles = []
})

function createParticle(x, y) {
  const offsetX = (Math.random() - 0.5) * 8
  const offsetY = (Math.random() - 0.5) * 8
  particles.push({
    x: x + offsetX,
    y: y + offsetY,
    size: Math.random() * 2.5 + 0.5,
    color: [currentTheme.primaryColor, currentTheme.secondaryColor, '#ffffff'][Math.floor(Math.random() * 3)],
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5 - 0.5, // 微微向上飘
    life: 1,
    decay: Math.random() * 0.02 + 0.015,
  })
}

function render() {
  animationFrameId = null
  if (!ctx || !canvasEl.value) return
  ctx.clearRect(0, 0, viewWidth, viewHeight)

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.life -= p.decay

    if (p.life > 0) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      const alpha = Math.max(0, p.life).toFixed(2)
      ctx.fillStyle = rgba(p.color, alpha)
      ctx.fill()
    }
  }

  particles = particles.filter((p) => p.life > 0)
  // 粒子全部消散后停帧，等待下一次鼠标移动再启动
  if (particles.length) animationFrameId = requestAnimationFrame(render)
}

function startLoop() {
  if (animationFrameId == null) animationFrameId = requestAnimationFrame(render)
}

function rgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function handlePointerMove(e) {
  if (e.pointerType && e.pointerType !== 'mouse') return
  for (let i = 0; i < 2; i++) {
    createParticle(e.clientX, e.clientY)
  }
  startLoop()
}

function handleResize() {
  const canvas = canvasEl.value
  if (!canvas) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  viewWidth = window.innerWidth
  viewHeight = window.innerHeight
  canvas.width = Math.floor(viewWidth * dpr)
  canvas.height = Math.floor(viewHeight * dpr)
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

onMounted(() => {
  if (!enabled) return
  ctx = canvasEl.value.getContext('2d')
  handleResize()
  window.addEventListener('resize', handleResize)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('pointermove', handlePointerMove)
  if (animationFrameId != null) cancelAnimationFrame(animationFrameId)
})
</script>
