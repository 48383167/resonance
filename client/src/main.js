import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'

createApp(App).use(router).mount('#app')

// 生产环境注册离线提示页：哈希资源缓存优先，私密内容只走网络
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 注册失败不影响正常使用
    })
  })
}
