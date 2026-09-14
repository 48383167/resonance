// 上传前图片压缩：长边不超过 2048px、JPEG 质量 0.82
// GIF / SVG 保持原样，小于 500KB 的图片跳过，压缩收益不足时也保留原图。
const MAX_EDGE = 2048
const QUALITY = 0.82
const MIN_SIZE = 500 * 1024
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml'])

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解码失败'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function outputTypeOf(file) {
  if (file.type === 'image/png') return 'image/png'
  if (file.type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

function renameFor(file, type) {
  const ext = type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg'
  const base = file.name.replace(/\.[^.]+$/, '') || 'image'
  return `${base}${ext}`
}

export async function compressImage(file) {
  if (!file?.type?.startsWith('image/') || SKIP_TYPES.has(file.type) || file.size < MIN_SIZE) return file
  try {
    const image = await loadImage(file)
    const naturalWidth = image.naturalWidth || image.width
    const naturalHeight = image.naturalHeight || image.height
    if (!naturalWidth || !naturalHeight) return file

    const scale = Math.min(1, MAX_EDGE / Math.max(naturalWidth, naturalHeight))
    const width = Math.max(1, Math.round(naturalWidth * scale))
    const height = Math.max(1, Math.round(naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(image, 0, 0, width, height)

    const type = outputTypeOf(file)
    const blob = await canvasToBlob(canvas, type, type === 'image/png' ? undefined : QUALITY)
    if (!blob || blob.size >= file.size) return file

    return new File([blob], renameFor(file, type), {
      type,
      lastModified: file.lastModified || Date.now(),
    })
  } catch {
    // 解码失败（如部分 HEIC）时退回原图，不阻断上传
    return file
  }
}
