<script setup>
import { computed } from 'vue'

// 恋爱树：随两人活动记录成长（种子→嫩芽→小树→开花→繁茂）
const props = defineProps({
  stage: { type: String, default: 'seed' }, // seed/sprout/sapling/blossom/lush
  progress: { type: Number, default: 0 },   // 距下一阶段进度 0-1
  total: { type: Number, default: 0 },
  nextAt: { type: Number, default: 5 },
})

const label = computed(() => ({
  seed: '种子', sprout: '嫩芽', sapling: '小树', blossom: '开花', lush: '繁茂',
}[props.stage] || '种子'))

const trunkH = computed(() => ({ seed: 0, sprout: 34, sapling: 70, blossom: 88, lush: 100 }[props.stage] || 0))
const crownR = computed(() => ({ seed: 0, sprout: 0, sapling: 26, blossom: 34, lush: 42 }[props.stage] || 0))
const flowers = computed(() => ({ seed: 0, sprout: 0, sapling: 0, blossom: 5, lush: 9 }[props.stage] || 0))
</script>

<template>
  <div class="flex flex-col items-center">
    <svg width="150" height="170" viewBox="0 0 150 170">
      <!-- 地面 -->
      <line x1="10" y1="140" x2="140" y2="140" stroke="rgba(255,255,255,0.25)" stroke-width="2" />
      <!-- 树干 -->
      <path v-if="trunkH > 0"
        :d="`M 75 140 C 75 ${140 - trunkH * 0.5} 70 ${140 - trunkH} 75 ${140 - trunkH} C 80 ${140 - trunkH} 75 ${140 - trunkH * 0.5} 75 140`"
        fill="#8a5a3a" stroke="#6b4226" stroke-width="1.5"
        style="transition: all 1.2s ease" />
      <!-- 树冠 -->
      <g v-if="crownR > 0" style="transition: all 1.2s ease">
        <circle cx="75" :cy="140 - trunkH - crownR * 0.4" :r="crownR" fill="rgba(126,200,140,0.75)" />
        <circle cx="58" :cy="140 - trunkH" :r="crownR * 0.62" fill="rgba(120,190,135,0.8)" />
        <circle cx="92" :cy="140 - trunkH" :r="crownR * 0.62" fill="rgba(120,190,135,0.8)" />
        <!-- 花朵 -->
        <g v-for="i in flowers" :key="i">
          <circle :cx="45 + ((i * 37) % 62)" :cy="120 - trunkH * 0.35 - ((i * 13) % 26)" r="5"
            :fill="i % 2 ? '#ffb3d1' : '#ffd9a0'" />
        </g>
      </g>
      <!-- 嫩芽叶 -->
      <g v-else-if="stage === 'sprout'" style="transition: all 1.2s ease">
        <ellipse cx="63" cy="118" rx="10" ry="5" fill="rgba(126,200,140,0.8)" transform="rotate(-30 63 118)" />
        <ellipse cx="87" cy="118" rx="10" ry="5" fill="rgba(126,200,140,0.8)" transform="rotate(30 87 118)" />
      </g>
      <!-- 种子 -->
      <ellipse v-else cx="75" cy="146" rx="8" ry="5" fill="#d8a77a" />
      <!-- 根须 -->
      <path d="M 75 146 C 73 154 66 158 62 160 M 75 146 C 77 154 84 158 88 160"
        stroke="rgba(216,167,122,0.6)" stroke-width="1.5" fill="none" v-if="stage !== 'seed'" />
    </svg>
    <div class="mt-1 text-sm text-white/70">{{ label }}</div>
    <div class="mt-2 h-2 w-40 overflow-hidden rounded-full bg-white/10">
      <div class="h-full rounded-full transition-all duration-700"
        style="background: linear-gradient(90deg, #d8a7ff, #7ec8ff)" :style="{ width: `${Math.round(progress * 100)}%` }" />
    </div>
    <div class="mt-1 text-xs text-white/45">共同记录 {{ total }} 次 · 下一阶段还需 {{ Math.max(0, nextAt - total) }} 次</div>
  </div>
</template>
