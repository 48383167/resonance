<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { session } from '../../../stores/session'
import { MAX_ITEM_TEXT, parseContentToItems } from '../../../utils/ruleItems.js'

// 条目行编辑器（新增 / 编辑规矩共用）：
//   自动换行多行输入、回车新增下一行、⊖ 删除、≡ 按住拖动排序、粘贴多行自动拆成多条
//   移动端聚焦时收起两侧元素，整行都是编辑区
// 约定：rows 由父组件持有（v-model 等价），本组件直接增删改其中的行
const props = defineProps({
  rows: { type: Array, required: true },
  showStatus: { type: Boolean, default: false },
  max: { type: Number, default: 50 },
})
const emit = defineEmits(['limit'])

let seq = 0
const rowKey = () => `row_${Date.now().toString(36)}_${++seq}`

const listEl = ref(null)
const focusedKey = ref(null)

// —— 自动增高：1 行起步，最多约 4 行（112px），再多内部滚动 ——
const MAX_TEXTAREA_HEIGHT = 112

function resize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + 2, MAX_TEXTAREA_HEIGHT)}px`
}

function resizeAll() {
  nextTick(() => {
    listEl.value?.querySelectorAll('textarea').forEach(resize)
  })
}

watch(focusedKey, resizeAll)
watch(() => props.rows.length, resizeAll)
onMounted(resizeAll)

function focusRow(key) {
  nextTick(() => {
    const input = listEl.value?.querySelector(`[data-key="${key}"] textarea`)
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
    resize(input)
  })
}

function addRow(afterIndex = props.rows.length - 1) {
  if (props.rows.length >= props.max) return emit('limit')
  const row = { key: rowKey(), text: '' }
  props.rows.splice(afterIndex + 1, 0, row)
  focusRow(row.key)
}

function removeRow(index) {
  props.rows.splice(index, 1)
}

function onRowEnter(event, index) {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  addRow(index)
}

function onFocus(row) {
  focusedKey.value = row.key
}

function onBlur() {
  focusedKey.value = null
}

// 「完成」按钮：pointerdown 阻止默认，避免按钮被隐藏前先触发失焦/重新聚焦
function finishEditing() {
  document.activeElement?.blur?.()
  focusedKey.value = null
}

// 粘贴多行：当前行放第一条，其余插到后面（保住「整段粘贴」的习惯）
function onPaste(event, index) {
  const text = event.clipboardData?.getData('text') || ''
  if (!text.includes('\n')) return
  const lines = parseContentToItems(text)
  if (!lines.length) return
  event.preventDefault()
  props.rows[index].text = lines[0]
  const rest = lines.slice(1)
  const room = Math.max(0, props.max - props.rows.length)
  const added = rest.slice(0, room).map((t) => ({ key: rowKey(), text: t }))
  if (added.length < rest.length) emit('limit')
  props.rows.splice(index + 1, 0, ...added)
  const last = added[added.length - 1]
  if (last) focusRow(last.key)
}

// 行尾认同状态（编辑已有条目时显示）
function rowStatus(row) {
  if (!row.id) return 'new'
  if (row.originalText !== undefined && row.text.trim() !== row.originalText) return 'new'
  if (row.effective) return 'both'
  return row.agreedIds?.includes(session.userId) ? 'mine' : 'pending'
}

const STATUS = {
  both: { icon: '✓', title: '双方已认同', class: 'text-accent' },
  mine: { icon: '✓', title: '我已认同，待 Ta 认同', class: 'text-theme-tertiary' },
  pending: { icon: '○', title: '待你认同', class: 'text-accent' },
  new: { icon: '新', title: '保存后等待认同', class: 'text-theme-tertiary' },
}

// —— 拖拽排序：按住 ≡ 才进入；不做边缘自动滚动 ——
const dragIndex = ref(-1)
const dragOffset = ref(0)
let startY = 0
let rowH = 44

function onHandleDown(event, index) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  dragIndex.value = index
  dragOffset.value = 0
  startY = event.clientY
  rowH = event.currentTarget.closest('li')?.offsetHeight || 44
  event.currentTarget.setPointerCapture?.(event.pointerId)
  event.preventDefault()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(event) {
  if (dragIndex.value < 0) return
  let offset = event.clientY - startY
  const dir = offset > rowH * 0.5 ? 1 : offset < -rowH * 0.5 ? -1 : 0
  if (dir) {
    const to = dragIndex.value + dir
    if (to >= 0 && to < props.rows.length) {
      const [row] = props.rows.splice(dragIndex.value, 1)
      props.rows.splice(to, 0, row)
      dragIndex.value = to
      startY += dir * rowH
      offset = event.clientY - startY
    }
  }
  dragOffset.value = offset
}

function onPointerUp() {
  dragIndex.value = -1
  dragOffset.value = 0
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

defineExpose({ addRow, focusRow })
</script>

<template>
  <div>
    <label class="mb-1 block text-xs text-theme-tertiary">条目（可留空）</label>

    <ul ref="listEl" class="surface-soft space-y-1 rounded-xl p-2.5 sm:p-3">
      <li v-for="(row, i) in rows" :key="row.key" :data-key="row.key"
        class="flex items-start gap-1 sm:gap-1.5"
        :class="dragIndex === i ? 'relative z-10 opacity-90' : ''"
        :style="dragIndex === i ? { transform: `translateY(${dragOffset}px)` } : ''">
        <span v-if="focusedKey !== row.key"
          class="w-5 shrink-0 pt-2.5 text-right text-[10px] tabular-nums text-theme-tertiary sm:w-6 sm:text-[11px]">{{ String(i + 1).padStart(2, '0') }}</span>

        <textarea v-model="row.text" rows="1"
          class="input-dark max-h-28 min-w-0 flex-1 resize-none scroll-mb-32 overflow-y-auto !px-3 !py-1.5 text-sm leading-6"
          :maxlength="MAX_ITEM_TEXT" placeholder="写一条，回车继续"
          @input="resize($event.target)" @focus="onFocus(row)" @blur="onBlur"
          @keydown.enter="onRowEnter($event, i)" @paste="onPaste($event, i)" />

        <span v-if="showStatus && focusedKey !== row.key" class="w-4 shrink-0 pt-2.5 text-center text-xs"
          :class="STATUS[rowStatus(row)].class" :title="STATUS[rowStatus(row)].title">{{ STATUS[rowStatus(row)].icon }}</span>

        <button v-if="focusedKey !== row.key"
          class="min-h-10 min-w-8 shrink-0 text-base text-theme-tertiary transition-colors hover:text-accent sm:min-w-9 sm:text-lg"
          title="删除这一条" @click="removeRow(i)">⊖</button>
        <button v-if="focusedKey !== row.key"
          class="min-h-10 min-w-8 shrink-0 cursor-grab touch-none select-none text-base text-theme-tertiary active:cursor-grabbing sm:min-w-9 sm:text-lg"
          title="按住拖动排序" @pointerdown="onHandleDown($event, i)">≡</button>
        <button v-if="focusedKey === row.key"
          class="min-h-10 shrink-0 rounded-lg px-2 text-xs text-accent"
          title="收起编辑" @pointerdown.prevent="finishEditing" @click="finishEditing">完成</button>
      </li>

      <li v-if="!rows.length" class="px-1 py-2 text-center text-xs text-theme-tertiary">
        还没有条目，点下面「添加一条」
      </li>
    </ul>

    <div class="mt-2 flex items-center justify-between">
      <button class="min-h-10 rounded-lg px-2 text-sm text-accent" @click="addRow()">＋ 添加一条</button>
      <span class="text-xs" :class="rows.length >= max ? 'danger-link' : 'text-theme-tertiary'">
        已 {{ rows.length }} 条（最多 {{ max }} 条）
      </span>
    </div>
    <p class="mt-1 text-[11px] leading-4 text-theme-tertiary">
      粘贴多行自动拆条<template v-if="showStatus"> · ✓ 已认同 · ○ 待你认同 · ⊘ 停用</template>
    </p>
  </div>
</template>
