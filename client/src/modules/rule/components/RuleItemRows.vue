<script setup>
import { nextTick, ref } from 'vue'
import { session } from '../../../stores/session'
import { MAX_ITEM_TEXT, parseContentToItems } from '../../../utils/ruleItems.js'

// 条目行编辑器（新增 / 编辑规矩共用）：
//   回车新增下一行、⊖ 删除、≡ 按住拖动排序、粘贴多行自动拆成多条
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

function focusRow(key) {
  nextTick(() => {
    const input = listEl.value?.querySelector(`[data-key="${key}"] input`)
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
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

    <ul ref="listEl" class="surface-soft space-y-1 rounded-xl p-3">
      <li v-for="(row, i) in rows" :key="row.key" :data-key="row.key"
        class="flex items-center gap-1.5"
        :class="dragIndex === i ? 'relative z-10 opacity-90' : ''"
        :style="dragIndex === i ? { transform: `translateY(${dragOffset}px)` } : ''">
        <span class="w-6 shrink-0 text-right text-[11px] tabular-nums text-theme-tertiary">{{ String(i + 1).padStart(2, '0') }}</span>

        <input v-model="row.text" class="input-dark !min-h-10 flex-1 !py-1.5 text-sm" :maxlength="MAX_ITEM_TEXT"
          placeholder="写一条，回车继续" @keydown.enter="onRowEnter($event, i)" @paste="onPaste($event, i)" />

        <span v-if="showStatus" class="w-4 shrink-0 text-center text-xs" :class="STATUS[rowStatus(row)].class"
          :title="STATUS[rowStatus(row)].title">{{ STATUS[rowStatus(row)].icon }}</span>

        <button class="min-h-10 min-w-9 shrink-0 text-lg text-theme-tertiary transition-colors hover:text-accent"
          title="删除这一条" @click="removeRow(i)">⊖</button>
        <button
          class="min-h-10 min-w-9 shrink-0 cursor-grab touch-none select-none text-lg text-theme-tertiary active:cursor-grabbing"
          title="按住拖动排序" @pointerdown="onHandleDown($event, i)">≡</button>
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
    <p class="mt-1 text-[11px] text-theme-tertiary">粘贴多行到任意一行，会自动拆成多条</p>
  </div>
</template>
