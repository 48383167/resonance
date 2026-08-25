// 根据 URL 推断媒体类型（上传时服务端返回 type，这里做渲染兜底）
export function mediaTypeOf(url) {
  if (/\.(mp4|webm|mov|avi|m4v|mkv|m3u8)$/i.test(url)) return 'video'
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg|heic)$/i.test(url)) return 'image'
  return 'file'
}
