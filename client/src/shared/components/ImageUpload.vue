<script setup>
import { computed, ref } from 'vue'
import { toast } from '../../stores/toast'
import { openLightbox } from '../../stores/lightbox'
import { mediaTypeOf } from '../../utils/media'

// 主题化上传器：批量选择 + 拖拽 + 实时进度；多图模式 v-model 为数组，单图模式为字符串
// 已上传项可点击预览（图片进灯箱，视频/文件新窗口打开）
const props = defineProps({
  modelValue: { type: [Array, String], default: () => [] },
  multiple: { type: Boolean, default: true },
  accept: { type: String, default: 'all' }, // 'image' | 'all'
  max: { type: Number, default: 20 },
})
const emit = defineEmits(['update:modelValue'])

const fileInput = ref(null)
const dragging = ref(false)
const tasks = ref([]) // { file, name, progress, status }

const list = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : (props.modelValue ? [props.modelValue] : [])))

const acceptAttr = computed(() => (props.accept === 'image' ? 'image/*' : 'image/*,video/*,application/pdf,.zip,.doc,.docx,.xls,.xlsx,.txt'))

const nameOf = (url) => decodeURIComponent(url.split('/').pop() || '附件')

function preview(url) {
  const type = mediaTypeOf(url)
  if (type === 'video' || type === 'file') return window.open(url, '_blank')
  const images = list.value.filter((u) => mediaTypeOf(u) === 'image')
  openLightbox(images, Math.max(0, images.indexOf(url)))
}

function uploadOne(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('resonance.token') || ''}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const task = tasks.value.find((t) => t.file === file)
        if (task) task.progress = Math.round((e.loaded / e.total) * 100)
      }
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (json.ok) resolve(json.data)
        else reject(new Error(json.error || '上传失败'))
      } catch {
        reject(new Error('上传响应异常'))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

async function handleFiles(files) {
  const picked = [...files].filter((f) => (props.accept === 'image' ? f.type.startsWith('image/') : true))
  if (!picked.length) return
  if (list.value.length + picked.length > props.max) {
    toast(`最多上传 ${props.max} 个附件`)
    return
  }
  for (const f of picked) {
    tasks.value.push({ file: f, name: f.name, progress: 0, status: 'uploading' })
  }
  const queue = [...tasks.value.filter((t) => t.status === 'uploading')]
  const results = new Map()
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const task = queue.shift()
      try {
        const { url } = await uploadOne(task.file)
        task.status = 'done'
        results.set(task, url)
      } catch (e) {
        task.status = 'error'
        toast(`${task.name} 上传失败：${e.message}`)
      }
    }
  })
  await Promise.all(workers)
  const urls = results.size ? [...results.values()] : []
  if (urls.length) {
    if (props.multiple) emit('update:modelValue', [...list.value, ...urls])
    else emit('update:modelValue', urls[0] || '')
  }
  tasks.value = tasks.value.filter((t) => t.status === 'uploading')
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e) {
  dragging.value = false
  if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
}

function remove(i) {
  if (props.multiple) {
    emit('update:modelValue', list.value.filter((_, j) => j !== i))
  } else {
    emit('update:modelValue', '')
  }
}
</script>

<template>
  <div>
    <!-- 已有附件预览（点击可查看） -->
    <div v-if="list.length" class="mb-3 space-y-2">
      <div v-for="(u, i) in list" :key="u"
        class="group flex items-center gap-3 rounded-xl bg-white/5 p-2 transition-colors hover:bg-white/10">
        <!-- 缩略图 -->
        <div class="relative h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-white/5" @click="preview(u)">
          <img v-if="mediaTypeOf(u) === 'image'" :src="u" class="h-full w-full object-cover" />
          <video v-else-if="mediaTypeOf(u) === 'video'" :src="u" class="h-full w-full object-cover" muted />
          <div v-else class="flex h-full w-full items-center justify-center text-2xl">📄</div>
          <span v-if="mediaTypeOf(u) === 'video'"
            class="pointer-events-none absolute inset-0 flex items-center justify-center text-xl drop-shadow">▶</span>
        </div>
        <!-- 名称与操作 -->
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-white/80">{{ nameOf(u) }}</p>
          <button type="button" class="mt-0.5 text-xs text-accent-2 hover-text-accent-2 hover:underline"
            @click="preview(u)">点击预览</button>
        </div>
        <button type="button" title="移除"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm text-white/50 transition-colors hover:bg-rose-500/80 hover:text-white"
          @click="remove(i)">×</button>
      </div>
    </div>

    <!-- 上传中进度 -->
    <div v-for="t in tasks.filter((x) => x.status === 'uploading')" :key="t.name"
      class="mb-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs">
      <div class="flex justify-between text-white/60">
        <span class="truncate">{{ t.name }}</span>
        <span>{{ t.progress }}%</span>
      </div>
      <div class="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full transition-all" style="background: linear-gradient(90deg,var(--accent),var(--accent-2))"
          :style="{ width: `${t.progress}%` }" />
      </div>
    </div>

    <!-- 拖拽/点击区域 -->
    <input ref="fileInput" type="file" :accept="acceptAttr" :multiple="multiple" class="hidden"
      @change="handleFiles($event.target.files)" />
    <button type="button"
      class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors"
          :class="dragging ? 'border-accent bg-accent-soft text-accent' : 'border-white/25 text-white/55 hover:border-white/40 hover:text-white/80'"
      @click="fileInput.click()"
      @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <span class="text-base">📎</span>
      {{ accept === 'image' ? '点击或拖拽图片到这里上传' : '点击或拖拽文件到这里（照片 / 视频 / 附件）' }}
    </button>
  </div>
</template>
