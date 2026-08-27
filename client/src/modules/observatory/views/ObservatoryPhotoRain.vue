<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { openLightbox } from '../../../stores/lightbox'

const props = defineProps({ photos: { type: Array, required: true } })
const DROP_COUNT = 16
const drops = ref([])
let stopped = false
let staticMode = false

function between(min, max) {
  return min + Math.random() * (max - min)
}

function makeDrop(id) {
  return {
    id,
    photoIndex: Math.floor(Math.random() * props.photos.length),
    left: `${between(2, 94).toFixed(2)}%`,
    fall: `${between(10, 16).toFixed(2)}s`,
    sway: `${between(-90, 90).toFixed(2)}px`,
    swayMid: `${between(-120, 120).toFixed(2)}px`,
    swayEnd: `${between(-105, 105).toFixed(2)}px`,
    rotateStart: `${between(-12, 12).toFixed(2)}deg`,
    rotateMid: `${between(-8, 8).toFixed(2)}deg`,
    rotateEnd: `${between(-12, 12).toFixed(2)}deg`,
    scale: between(0.84, 1.06).toFixed(2),
    staticTop: `${between(8, 78).toFixed(2)}%`,
    running: false,
    timer: null,
  }
}

function schedule(drop, wait) {
  if (staticMode) return
  window.clearTimeout(drop.timer)
  drop.timer = window.setTimeout(() => {
    if (!stopped) drop.running = true
  }, wait)
}

function restart(drop) {
  if (stopped) return
  drop.running = false
  Object.assign(drop, makeDrop(drop.id))
  schedule(drop, between(250, 1200))
}

function openPhoto(drop) {
  const urls = props.photos.map((photo) => photo.url)
  const index = props.photos.findIndex((photo) => photo.id === props.photos[drop.photoIndex]?.id)
  if (index >= 0) openLightbox(urls, index)
}

onMounted(() => {
  staticMode = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  drops.value = Array.from({ length: DROP_COUNT }, (_, id) => makeDrop(id))
  if (!staticMode) drops.value.forEach((drop) => schedule(drop, between(0, 5000)))
})

onUnmounted(() => {
  stopped = true
  drops.value.forEach((drop) => window.clearTimeout(drop.timer))
})
</script>

<template>
  <section class="photo-rain-stage" aria-label="照片雨">
    <span class="photo-rain-cloud" aria-hidden="true">☁︎<small>温柔降落中</small></span>
    <button v-for="drop in drops" :key="drop.id" type="button" class="photo-rain-drop"
      :style="{
        '--left': drop.left,
        '--fall': drop.fall,
        '--sway': drop.sway,
        '--sway-mid': drop.swayMid,
        '--sway-end': drop.swayEnd,
        '--rotate-start': drop.rotateStart,
        '--rotate-mid': drop.rotateMid,
        '--rotate-end': drop.rotateEnd,
        '--scale': drop.scale,
        '--static-top': drop.staticTop,
      }"
      :class="{ 'is-running': drop.running }"
      :aria-label="`查看第 ${drop.photoIndex + 1} 张相册照片`"
      @animationend="restart(drop)"
      @click="openPhoto(drop)">
      <img :src="photos[drop.photoIndex].url" alt="" loading="lazy" decoding="async" />
    </button>
  </section>
</template>

<style scoped>
.photo-rain-stage {
  position: relative;
  min-height: min(72svh, 680px);
  overflow: hidden;
  border: 1px solid rgb(var(--border-subtle-rgb) / 0.14);
  border-radius: 1.5rem;
  background: linear-gradient(180deg, rgb(var(--accent-2-rgb) / 0.17), rgb(var(--surface-1-rgb) / 0.05));
  isolation: isolate;
}

.photo-rain-cloud {
  position: absolute;
  top: 12%;
  left: 50%;
  z-index: 1;
  color: var(--accent);
  font-size: 4rem;
  line-height: 0.7;
  text-shadow: 0 0 25px rgb(var(--accent-rgb) / 0.5);
  transform: translateX(-50%);
}

.photo-rain-cloud small {
  display: block;
  color: rgb(var(--text-primary-rgb) / 0.6);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  white-space: nowrap;
}

.photo-rain-drop {
  position: absolute;
  top: -190px;
  left: var(--left);
  width: clamp(70px, 12vw, 135px);
  aspect-ratio: 0.8;
  padding: 0.3rem;
  border: 1px solid rgb(var(--text-primary-rgb) / 0.3);
  border-radius: 0.8rem;
  background: rgb(var(--surface-1-rgb) / 0.2);
  box-shadow: 0 12px 25px rgb(0 0 0 / 0.25);
  cursor: zoom-in;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: filter 0.3s, transform 0.3s;
}

.photo-rain-drop.is-running {
  visibility: visible;
  pointer-events: auto;
  animation: photoRainFall var(--fall) linear both;
}

.photo-rain-drop img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0.55rem;
  object-fit: cover;
}

.photo-rain-drop:hover,
.photo-rain-drop:focus-visible {
  z-index: 3;
  filter: brightness(1.13);
  outline: none;
  animation-play-state: paused;
  transform: scale(1.1) rotate(0);
}

@keyframes photoRainFall {
  0% { opacity: 0; transform: translate3d(0, 0, 0) rotate(var(--rotate-start)) scale(var(--scale)); }
  8% { opacity: 0.35; transform: translate3d(var(--sway), 80px, 0) rotate(var(--rotate-mid)) scale(var(--scale)); }
  17% { opacity: 1; transform: translate3d(var(--sway-mid), 180px, 0) rotate(var(--rotate-mid)) scale(var(--scale)); }
  55% { transform: translate3d(var(--sway), 52vh, 0) rotate(var(--rotate-end)) scale(var(--scale)); }
  100% { opacity: 0.08; transform: translate3d(var(--sway-end), calc(100svh + 360px), 0) rotate(var(--rotate-end)) scale(var(--scale)); }
}

@media (max-width: 640px) {
  .photo-rain-stage { min-height: 68svh; }
  .photo-rain-drop { width: 22vw; }
  .photo-rain-cloud { top: 15%; }
}

@media (prefers-reduced-motion: reduce) {
  .photo-rain-drop {
    top: var(--static-top);
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    animation: none;
    transform: rotate(-2deg);
  }
}
</style>
