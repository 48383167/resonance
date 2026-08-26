<template>
  <!-- 捕捉鼠标移动，指针事件穿透，绝对置顶 -->
  <canvas ref="canvasEl" class="pointer-events-none fixed inset-0 z-[9999] h-full w-full"></canvas>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { currentTheme } from '../stores/theme'

const canvasEl = ref(null)
let ctx = null
let particles = []
let animationFrameId = null
// 缓存上次鼠标位置，用于插值移动
let lastPos = { x: -100, y: -100 }
let currentPos = { x: -100, y: -100 }

watch(() => [currentTheme.primaryColor, currentTheme.secondaryColor], () => {
  particles = []
})

function createParticle(x, y) {
  // 随机分布在鼠标附近
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
  if (!ctx || !canvasEl.value) return
  const width = canvasEl.value.width
  const height = canvasEl.value.height
  
  // 清除上一帧 (使用略带透明度的清除可以做拖影，但由于直接清空更干净，这里采用直接清空)
  ctx.clearRect(0, 0, width, height)

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.life -= p.decay
    
    if (p.life > 0) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      // 根据生命周期调整透明度
      const alpha = Math.max(0, p.life).toFixed(2)
      ctx.fillStyle = rgba(p.color, alpha)
      ctx.fill()
    }
  }

  // 移除生命终结的粒子
  particles = particles.filter(p => p.life > 0)
  
  animationFrameId = requestAnimationFrame(render)
}

function rgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function handleMouseMove(e) {
  currentPos = { x: e.clientX, y: e.clientY }
  // 创建粒子：数量可以控制颗粒感
  for (let i = 0; i < 2; i++) {
    createParticle(currentPos.x, currentPos.y)
  }
}

function handleResize() {
  if (!canvasEl.value) return
  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
}

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  handleResize()
  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', handleMouseMove)
  render()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
</script>
