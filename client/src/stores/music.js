import { reactive } from 'vue'
import { listTracks } from '../modules/music/music.api.js'
import { toast } from './toast'

const STORAGE_KEY = 'resonance.music.state'
const DEFAULT_VOLUME = 0.5

function readSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}
  } catch {
    return {}
  }
}

function numberOr(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const snapshot = readSnapshot()
const savedTrack = snapshot.track?.audio ? snapshot.track : null

export const musicState = reactive({
  tracks: savedTrack ? [savedTrack] : [],
  index: 0,
  currentTime: Math.max(0, numberOr(snapshot.currentTime, 0)),
  volume: Math.min(1, Math.max(0, numberOr(snapshot.volume, DEFAULT_VOLUME))),
  playing: false,
  loading: false,
  resumePending: Boolean(snapshot.shouldPlay && savedTrack),
})

function currentTrack() {
  return musicState.tracks[musicState.index] || null
}

let audio = null
let source = ''
let restored = false
let resumeListenerAttached = false
let lastPersistAt = 0

function persist() {
  if (typeof localStorage === 'undefined') return
  const currentTime = audio ? Math.max(0, numberOr(audio.currentTime, musicState.currentTime)) : musicState.currentTime
  musicState.currentTime = currentTime
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      track: currentTrack(),
      currentTime,
      volume: musicState.volume,
      shouldPlay: musicState.playing || musicState.resumePending,
    }))
  } catch {
    // 忽略本地存储不可用，不影响播放。
  }
}

function removeResumeListeners() {
  if (!resumeListenerAttached || typeof document === 'undefined') return
  document.removeEventListener('pointerdown', resumeOnInteraction, true)
  document.removeEventListener('keydown', resumeOnInteraction, true)
  resumeListenerAttached = false
}

function resumeOnInteraction(event) {
  if (event.type === 'pointerdown' && event.target?.closest?.('.music-player')) return
  removeResumeListeners()
  if (!musicState.resumePending) return
  musicState.resumePending = false
  void playCurrent()
}

function armResume() {
  if (!musicState.resumePending || resumeListenerAttached || typeof document === 'undefined') return
  resumeListenerAttached = true
  document.addEventListener('pointerdown', resumeOnInteraction, true)
  document.addEventListener('keydown', resumeOnInteraction, true)
}

function seekToSavedTime(target) {
  if (!audio || target <= 0) return
  try {
    const duration = Number(audio.duration)
    audio.currentTime = Number.isFinite(duration) && duration > 0 ? Math.min(target, Math.max(0, duration - 0.25)) : target
  } catch {
    // 媒体元数据尚未准备好，loadedmetadata 会再次尝试。
  }
}

function setSource(track, seekTime = 0) {
  const a = ensureAudio()
  musicState.currentTime = Math.max(0, numberOr(seekTime, 0))
  if (source !== track.audio) {
    source = track.audio
    a.src = track.audio
    a.load()
  }
  if (musicState.currentTime > 0) {
    if (a.readyState >= 1) seekToSavedTime(musicState.currentTime)
    else a.addEventListener('loadedmetadata', () => seekToSavedTime(musicState.currentTime), { once: true })
  }
}

function ensureAudio() {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'metadata'
  audio.volume = musicState.volume
  audio.addEventListener('timeupdate', () => {
    musicState.currentTime = Math.max(0, numberOr(audio.currentTime, 0))
    if (Date.now() - lastPersistAt > 1000) {
      lastPersistAt = Date.now()
      persist()
    }
  })
  audio.addEventListener('play', () => {
    musicState.playing = true
    musicState.resumePending = false
    persist()
  })
  audio.addEventListener('ended', () => { void nextTrack() })
  return audio
}

export function restoreMusic() {
  if (restored) return
  restored = true
  if (!currentTrack()) return
  setSource(currentTrack(), musicState.currentTime)
  armResume()
}

export async function loadRandomTrack() {
  if (musicState.loading) return false
  musicState.loading = true
  try {
    const tracks = await listTracks()
    const track = Array.isArray(tracks) ? tracks.find((item) => item?.audio) : null
    if (!track) return false
    musicState.tracks = [...musicState.tracks, track]
    musicState.index = musicState.tracks.length - 1
    musicState.currentTime = 0
    setSource(track)
    persist()
    return true
  } catch (error) {
    toast(error.message)
    return false
  } finally {
    musicState.loading = false
  }
}

export async function playCurrent() {
  const track = currentTrack()
  if (!track) return false
  const a = ensureAudio()
  if (source !== track.audio) setSource(track, musicState.currentTime)
  musicState.resumePending = false
  try {
    await a.play()
    musicState.playing = true
    persist()
    return true
  } catch {
    musicState.playing = false
    persist()
    return false
  }
}

export function pauseMusic() {
  musicState.resumePending = false
  musicState.playing = false
  audio?.pause()
  persist()
}

export async function toggleMusic() {
  if (musicState.loading) return false
  if (musicState.playing) {
    pauseMusic()
    return false
  }
  if (!currentTrack() && !(await loadRandomTrack())) return false
  return playCurrent()
}

export async function nextTrack() {
  if (musicState.loading) return false
  if (!currentTrack()) return false
  const shouldPlay = musicState.playing
  if (musicState.index < musicState.tracks.length - 1) {
    musicState.index += 1
    musicState.currentTime = 0
    setSource(currentTrack())
    persist()
    if (shouldPlay) await playCurrent()
    return true
  }
  const loaded = await loadRandomTrack()
  if (loaded && shouldPlay) await playCurrent()
  return loaded
}

export async function previousTrack() {
  if (musicState.loading || musicState.index <= 0) return false
  const shouldPlay = musicState.playing
  musicState.index -= 1
  musicState.currentTime = 0
  setSource(currentTrack())
  persist()
  if (shouldPlay) await playCurrent()
  return true
}

export function stopMusic() {
  removeResumeListeners()
  audio?.pause()
  audio = null
  source = ''
  restored = false
  musicState.tracks = []
  musicState.index = 0
  musicState.currentTime = 0
  musicState.playing = false
  musicState.resumePending = false
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略本地存储不可用。
  }
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', persist)
