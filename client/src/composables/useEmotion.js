import { reactive } from 'vue'

// —— 情绪墨水 (Kinetic Emotion Typing)：采集 WPM / 退格 / 停顿 ——
export function useEmotion() {
  const metrics = reactive({ wpm: 0, backspaceCount: 0, pauseDuration: 0, charCount: 0 })
  let startAt = Date.now()
  let lastKeyAt = Date.now()
  let lastLength = 0

  function onInput(value) {
    const now = Date.now()
    const gap = now - lastKeyAt
    if (gap > 1500) metrics.pauseDuration += gap // 超过 1.5s 视为停顿
    lastKeyAt = now

    const len = value.length
    if (len < lastLength) metrics.backspaceCount += lastLength - len
    else metrics.charCount += len - lastLength
    lastLength = len

    const minutes = (now - startAt) / 60000
    metrics.wpm = minutes > 0 ? Math.round(metrics.charCount / 5 / minutes) : 0
  }

  function reset() {
    metrics.wpm = 0
    metrics.backspaceCount = 0
    metrics.pauseDuration = 0
    metrics.charCount = 0
    startAt = Date.now()
    lastKeyAt = Date.now()
    lastLength = 0
  }

  return { metrics, onInput, reset }
}

// —— 渲染规则：用字重和透明度表现情绪，避免影响正文清晰度 ——
export function emotionStyle(m) {
  const style = {}
  if (m.wpm >= 60) {
    style.fontWeight = 700
  } else if (m.wpm >= 35) {
    style.fontWeight = 600
  }
  if (m.backspaceCount >= 10 || m.pauseDuration >= 4000) {
    style.opacity = 0.82
  }
  return style
}

export function emotionSummary(m) {
  const parts = [`${m.wpm} 字/分`]
  if (m.backspaceCount > 0) parts.push(`删改 ${m.backspaceCount} 次`)
  if (m.pauseDuration > 0) parts.push(`停顿 ${(m.pauseDuration / 1000).toFixed(1)}s`)
  return parts.join(' · ')
}
