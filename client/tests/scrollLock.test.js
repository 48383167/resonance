import test from 'node:test'
import assert from 'node:assert/strict'
import { lockBodyScroll } from '../src/utils/scrollLock.js'

test('nested overlays retain the lock regardless of close order and repeated cleanup', () => {
  globalThis.document = { body: { style: { overflow: 'auto' } } }
  try {
    const closeModal = lockBodyScroll()
    const closeLightbox = lockBodyScroll()
    closeModal()
    closeModal()
    assert.equal(document.body.style.overflow, 'hidden')
    closeLightbox()
    assert.equal(document.body.style.overflow, 'auto')
    closeLightbox()
    assert.equal(document.body.style.overflow, 'auto')
  } finally {
    delete globalThis.document
  }
})
