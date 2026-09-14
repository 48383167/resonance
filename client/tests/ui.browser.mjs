// Run against Vite: REVIEW_BASE_URL=http://127.0.0.1:5173 node client/tests/ui.browser.mjs
// PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE may point to an external test installation.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await context.route(/\/api\//, (route) => new URL(route.request().url()).pathname.startsWith('/api/')
  ? route.fulfill({ json: { ok: true, data: {} } }) : route.continue())
await context.route(/\/socket\.io\//, (route) => new URL(route.request().url()).pathname.startsWith('/socket.io/') ? route.abort() : route.continue())
try {
  await page.goto(process.env.REVIEW_BASE_URL || 'http://127.0.0.1:5173')
  await page.waitForFunction(() => Boolean(document.querySelector('#app')?.__vue_app__)).catch((error) => { throw new Error(`${error.message}; browser errors: ${errors.join('; ')}`) })
  await page.evaluate(async () => {
    document.querySelector('#app').__vue_app__.unmount()
    const { createApp, h, ref } = await import('/node_modules/.vite/deps/vue.js')
    const paths = ['ImageUpload', 'AppModal', 'ConfirmDialog', 'ImageLightbox', 'AppSelect', 'AppDatePicker']
    const [Upload, Modal, Confirm, Lightbox, Select, DatePicker] = await Promise.all(paths.map(async (name) => (await import(`/src/shared/components/${name}.vue`)).default))
    const theme = await import('/src/stores/theme.js')
    const presets = await import('/src/theme/presets.js')
    const confirm = await import('/src/stores/confirm.js')
    const lightbox = await import('/src/stores/lightbox.js')
    const files = ref([]), multiple = ref(true), modal = ref(false), choice = ref('a'), date = ref('2026-09-14')
    window.qa = { ...theme, ...presets, ...confirm, ...lightbox, files, multiple, modal, choice, date, requests: [] }
    window.XMLHttpRequest = class {
      upload = {}
      open() {}
      setRequestHeader() {}
      send(form) { this.name = form.get('file').name; window.qa.requests.push(this) }
      abort() { this.onabort?.() }
      finish() {
        this.status = 200
        this.responseText = JSON.stringify({ ok: true, data: { id: this.name, name: this.name, url: `/media/${this.name}`, type: 'file' } })
        this.onload()
      }
    }
    createApp({ render: () => h('div', { style: 'padding:24px;max-width:680px;margin:auto' }, [
      h('h1', { class: 'serif text-xl mb-4' }, '共鸣 · 交互与主题验证'),
      h('button', { class: 'btn-primary', id: 'primary' }, '保存这份心意'),
      h('input', { class: 'input-dark my-4', placeholder: '写下今天的小确幸' }),
      h(Select, { modelValue: choice.value, options: [{ value: 'a', label: '温柔' }, { value: 'b', label: '喜悦' }], 'onUpdate:modelValue': (value) => { choice.value = value } }),
      h(DatePicker, { modelValue: date.value, 'onUpdate:modelValue': (value) => { date.value = value } }),
      h(Upload, { max: 4, multiple: multiple.value, modelValue: files.value, 'onUpdate:modelValue': (value) => { files.value = value } }),
      h(Modal, { open: modal.value, title: '留住这一刻', onClose: () => { modal.value = false } }, () => h('p', { class: 'text-white/60', id: 'modal-copy' }, '浅色与深色主题都应清晰可读。')),
      h(Confirm), h(Lightbox),
    ]) }).mount('#app')
  })

  const themes = await page.evaluate(() => [...qa.THEME_PRESETS.map(qa.presetConfig), { themeKey: 'custom', appearanceMode: 'dark', primaryColor: '#aa88dd', secondaryColor: '#55bbaa', ambientColor: '#101020' }, { themeKey: 'custom', appearanceMode: 'light', primaryColor: '#7450aa', secondaryColor: '#27654a', ambientColor: '#f4f0fa' }])
  await mkdir('.smoke-data-review/screenshots', { recursive: true })
  for (const config of themes) {
    const result = await page.evaluate(async (config) => {
      qa.applyTheme(config)
      qa.modal.value = true
      await new Promise((resolve) => setTimeout(resolve, 350))
      const color = getComputedStyle(document.querySelector('#modal-copy')).color
      const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface-2')
      const luminance = (hex) => {
        const c = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
      }
      const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
      return { color, surface, meta: document.querySelector('meta[name="theme-color"]').content,
        accentContrast: ratio(qa.currentTheme.accentText, surface), overflow: document.documentElement.scrollWidth > innerWidth }
    }, config)
    assert.equal(result.meta, config.ambientColor)
    assert.equal(result.overflow, false)
    assert.ok(result.accentContrast >= 4.5, `${config.themeKey} accent contrast ${result.accentContrast}`)
    if (config.appearanceMode === 'light') assert.notEqual(result.color, 'rgb(255, 255, 255)')
    await page.screenshot({ path: `.smoke-data-review/screenshots/${config.themeKey}-${config.appearanceMode}.png` })
    await page.evaluate(() => { qa.modal.value = false })
  }
  console.log('PASS 8 presets + custom light/dark: popup contrast, accent contrast, browser theme color, mobile overflow')
  await page.locator('.am-backdrop').waitFor({ state: 'hidden' })

  const select = page.locator('[aria-haspopup="listbox"]')
  await select.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => qa.choice.value), 'b')
  await page.getByRole('button', { name: '清除日期', exact: true }).focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => qa.date.value), '')
  assert.equal(await page.locator('.date-picker-popup').count(), 0)
  console.log('PASS keyboard selection and date clear without opening picker')

  const payload = (name) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(name) })
  const input = page.locator('input[type="file"]')
  await input.setInputFiles([payload('a.txt'), payload('b.txt')])
  await page.waitForFunction(() => qa.requests.length === 2)
  await page.evaluate(() => qa.requests[0].upload.onprogress({ lengthComputable: true, loaded: 75, total: 100 }))
  await page.getByText('75%', { exact: true }).waitFor()
  await page.evaluate(() => qa.requests[0].finish())
  await page.getByText('已上传', { exact: true }).waitFor()
  await input.setInputFiles([payload('c.txt'), payload('d.txt'), payload('e.txt')])
  assert.equal(await page.evaluate(() => qa.requests.length), 2)
  await page.evaluate(() => qa.requests[1].finish())
  await page.waitForFunction(() => qa.requests.length === 4)
  await page.evaluate(() => { qa.requests[2].finish(); qa.requests[3].finish() })
  await page.waitForFunction(() => qa.files.value.length === 4)
  assert.deepEqual(await page.evaluate(() => qa.files.value.map((file) => file.name)), ['a.txt', 'b.txt', 'c.txt', 'd.txt'])
  await page.evaluate(() => { qa.multiple.value = false; qa.files.value = { id: 'old', url: '/old.txt' } })
  await input.setInputFiles(payload('replacement.txt'))
  await page.waitForFunction(() => qa.requests.length === 5)
  await page.evaluate(() => qa.requests[4].finish())
  await page.waitForFunction(() => qa.files.value.name === 'replacement.txt')
  console.log('PASS live upload progress, cross-batch capacity/order, single-file replacement')

  await page.evaluate(() => {
    qa.openLightbox(['data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"/>'])
    qa.modal.value = true
  })
  await page.locator('.image-lightbox').waitFor()
  await page.evaluate(() => {
    const root = document.querySelector('.image-lightbox')
    const touch = (id, x) => new Touch({ identifier: id, target: root, clientX: x, clientY: 100 })
    root.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 200)], changedTouches: [touch(1, 200)], bubbles: true }))
    root.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 200), touch(2, 220)], changedTouches: [touch(2, 220)], bubbles: true }))
    root.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(1, 80)], bubbles: true }))
  })
  assert.equal(await page.evaluate(() => qa.lightbox.index), 0)
  await page.evaluate(() => {
    const root = document.querySelector('.image-lightbox')
    const touch = (x) => new Touch({ identifier: 1, target: root, clientX: x, clientY: 100 })
    root.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(200)], changedTouches: [touch(200)], bubbles: true }))
    root.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(80)], bubbles: true }))
    document.querySelector('.lightbox-image').click()
  })
  assert.equal(await page.evaluate(() => qa.lightbox.index), 1)
  assert.equal(await page.evaluate(() => qa.lightbox.open), true)
  await page.evaluate(() => { qa.modal.value = false })
  await page.locator('.am-backdrop').waitFor({ state: 'hidden' })
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
  await page.evaluate(() => qa.closeLightbox())
  await page.locator('.image-lightbox').waitFor({ state: 'hidden' })
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
  console.log('PASS pinch does not change image, swipe click suppression, nested overlay scroll lock')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const duration = await page.locator('#primary').evaluate((element) => getComputedStyle(element).transitionDuration)
  assert.ok(parseFloat(duration) < .001)
  assert.deepEqual(errors, [])
  console.log('PASS reduced motion and no browser runtime errors')
} finally {
  await browser.close()
}
