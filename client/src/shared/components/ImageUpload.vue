<script setup>
import { computed, ref } from 'vue'
import { toast } from '../../stores/toast'
import { openLightbox } from '../../stores/lightbox'
import { mediaTypeOf } from '../../utils/media'

// 主题化上传器：批量选择 + 拖拽 + 实时进度
// v-model 值：文件对象 { id, url, type, name }（id 为文件表 ID，后端业务表存 id）
// 兼容旧值：字符串 URL 会被规整为 { id:'', url, type:推断, name:文件名 }
// 多图模式 v-model 为数组，单图模式为单个对象或 ''
const props = defineProps({
  modelValue: { type: [Array, String, Object], default: () => [] },
  multiple: { type: Boolean, default: true },
  accept: { type: String, default: 'all' }, // 'image' | 'all'
  max: { type: Number, default: 20 },
})
const emit = defineEmits(['update:modelValue'])

const fileInput = ref(null)
const dragging = ref(false)
const tasks = ref([]) // { file, name, progress, status }

const normalize = (v) => {
  if (!v) return null
  if (typeof v === 'string') {
    return {
      id: '',
      url: v,
      type: mediaTypeOf(v),
      name: decodeURIComponent(v.split('/').pop() || '附件'),
    }
  }
  if (typeof v === 'object') {
    return {
      id: v.id || v.fileId || '',
      url: v.url || '',
      type: v.type || mediaTypeOf(v.url || ''),
      name: v.name || (v.url ? decodeURIComponent(v.url.split('/').pop() || '附件') : '附件'),
    }
  }
  return null
}

const list = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue.map(normalize).filter(Boolean)
  if (props.modelValue) {
    const item = normalize(props.modelValue)
    return item ? [item] : []
  }
  return []
})

const acceptAttr = computed(() => (props.accept === 'image' ? 'image/*' : 'image/*,video/*,application/pdf,.zip,.doc,.docx,.xls,.xlsx,.txt'))

const nameOf = (u) => u.name || decodeURIComponent((u.url || '').split('/').pop() || '附件')

function preview(u) {
  const type = u.type || mediaTypeOf(u.url || '')
  if (type === 'video' || type === 'file') return window.open(u.url, '_blank')
  const images = list.value.filter((x) => (x.type || mediaTypeOf(x.url || '')) === 'image')
  openLightbox(images.map((x) => x.url), Math.max(0, images.findIndex((x) => x === u)))
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
        else reject(new Error(typeof json.error === 'object' ? json.error.message : json.error || '上传失败'))
      } catch {
        reject(new Error(xhr.status === 413 ? '文件过大，服务器拒绝了上传' : (xhr.status ? `上传失败（HTTP ${xhr.status}）` : '上传响应异常')))
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
        const data = await uploadOne(task.file)
        task.status = 'done'
        results.set(task, {
          id: data.id || '',
          url: data.url,
          type: data.type || mediaTypeOf(data.url),
          name: data.name || task.name,
        })
      } catch (e) {
        task.status = 'error'
        toast(`${task.name} 上传失败：${e.message}`)
      }
    }
  })
  await Promise.all(workers)
  const items = results.size ? [...results.values()] : []
  if (items.length) {
    if (props.multiple) emit('update:modelValue', [...list.value, ...items])
    else emit('update:modelValue', items[0] || '')
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
      <div v-for="(u, i) in list" :key="u.url || u.id || i"
         class="group flex min-w-0 items-center gap-3 rounded-xl bg-white/5 p-2 transition-colors hover:bg-white/10">
        <!-- 缩略图 -->
        <div class="relative h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-white/5" @click="preview(u)">
          <img v-if="u.type === 'image' || mediaTypeOf(u.url || '') === 'image'" :src="u.url" class="h-full w-full object-cover" />
          <video v-else-if="u.type === 'video' || mediaTypeOf(u.url || '') === 'video'" :src="u.url" class="h-full w-full object-cover" muted />
          <div v-else class="flex h-full w-full items-center justify-center text-2xl">📄</div>
          <span v-if="u.type === 'video' || mediaTypeOf(u.url || '') === 'video'"
            class="pointer-events-none absolute inset-0 flex items-center justify-center text-xl drop-shadow">▶</span>
        </div>
        <!-- 名称与操作 -->
        <div class="min-w-0 flex-1">
           <p class="break-anywhere text-sm text-white/80">{{ nameOf(u) }}</p>
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
        <span class="min-w-0 break-anywhere">{{ t.name }}</span>
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
      class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-center text-sm transition-colors"
          :class="dragging ? 'border-accent bg-accent-soft text-accent' : 'border-white/25 text-white/55 hover:border-white/40 hover:text-white/80'"
      @click="fileInput.click()"
      @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <span class="text-base">📎</span>
      {{ accept === 'image' ? '点击或拖拽图片到这里上传' : '点击或拖拽文件到这里（照片 / 视频 / 附件）' }}
    </button>
  </div>
</template>
