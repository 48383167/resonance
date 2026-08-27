<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { navigationGroups, navigationItems, primaryNavigationNames } from '../navigation.js'

const route = useRoute()
const dock = ref(null)
const moreOpen = ref(false)

const primaryItems = computed(() => navigationItems.filter((item) => primaryNavigationNames.includes(item.name)))
const moreActive = computed(() => navigationItems.some((item) => !primaryNavigationNames.includes(item.name) && isItemActive(item)))

function isItemActive(item) {
  return item.activeRoutes.includes(route.name)
}

function closeMore() {
  moreOpen.value = false
}

function onDocumentClick(event) {
  if (dock.value && !dock.value.contains(event.target)) closeMore()
}

watch(() => route.fullPath, closeMore)

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="dock" class="app-dock fixed bottom-5 left-1/2 z-[55] -translate-x-1/2" @click.stop>
    <Transition name="dock-panel">
      <div v-if="moreOpen" class="app-dock__panel glass absolute bottom-[calc(100%+14px)] left-1/2 max-h-[min(70svh,36rem)] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto overscroll-contain p-4">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold text-theme-primary">全部功能</div>
            <div class="mt-0.5 text-xs text-theme-tertiary">不必回到首页，随时去想去的地方</div>
          </div>
          <button class="text-xs text-theme-tertiary transition-colors hover:text-theme-primary" aria-label="收起全部功能" @click="closeMore">收起</button>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div v-for="group in navigationGroups" :key="group.label" class="rounded-xl bg-white/[0.04] p-2">
            <div class="mb-1 px-2 text-[10px] uppercase tracking-[0.18em] text-theme-tertiary">{{ group.label }}</div>
            <router-link v-for="item in group.items" :key="item.name" :to="{ name: item.route }"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-white/10"
              :class="isItemActive(item) ? 'bg-white/10 text-accent' : 'text-theme-secondary'"
              :aria-current="isItemActive(item) ? 'page' : undefined" @click="closeMore">
              <span class="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-sm">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </Transition>

    <div class="app-dock__bar flex items-end gap-1 rounded-[1.4rem] p-2 sm:gap-2 sm:p-2.5">
      <router-link v-for="item in primaryItems" :key="item.name" :to="{ name: item.route }"
        class="app-dock__item group" :class="{ 'app-dock__item--active': isItemActive(item) }"
        :aria-label="item.label" :title="item.label" :aria-current="isItemActive(item) ? 'page' : undefined">
        <span class="app-dock__icon">{{ item.icon }}</span>
        <span class="app-dock__tooltip">{{ item.label }}</span>
      </router-link>
      <router-link :to="{ name: 'write-solo' }" class="app-dock__item app-dock__item--create group"
        :class="{ 'app-dock__item--active': route.name === 'write-solo' }" aria-label="写日记" title="写日记">
        <span class="app-dock__icon">+</span>
        <span class="app-dock__tooltip">写日记</span>
      </router-link>
      <button class="app-dock__item group" :class="{ 'app-dock__item--active': moreOpen || moreActive }"
        aria-label="更多功能" title="更多功能" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
        <span class="app-dock__icon text-xl tracking-widest">•••</span>
        <span class="app-dock__tooltip">更多功能</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-dock__bar {
  border: 1px solid rgb(var(--border-subtle-rgb) / 0.2);
  background: rgb(var(--page-bg-rgb) / 0.72);
  box-shadow: 0 16px 42px rgb(var(--shadow-rgb) / 0.38), 0 0 0 1px rgb(var(--accent-rgb) / 0.06);
  backdrop-filter: blur(22px) saturate(1.3);
}

.app-dock__item {
  position: relative;
  display: flex;
  height: 48px;
  width: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  color: var(--text-secondary);
  transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.app-dock__item:hover {
  transform: translateY(-5px) scale(1.08);
  color: var(--text-primary);
  background: rgb(var(--text-primary-rgb) / 0.1);
}

.app-dock__item--active {
  color: var(--accent-text);
  background: rgb(var(--accent-rgb) / 0.14);
}

.app-dock__item--active::after {
  position: absolute;
  bottom: -5px;
  left: 50%;
  height: 3px;
  width: 3px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 9px var(--accent);
  content: '';
  transform: translateX(-50%);
}

.app-dock__item--create {
  height: 54px;
  width: 54px;
  margin: 0 3px;
  border-radius: 1.15rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--accent-contrast);
  box-shadow: 0 7px 22px rgb(var(--accent-rgb) / 0.35);
}

.app-dock__item--create:hover {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--accent-contrast);
}

.app-dock__icon {
  font-size: 1.25rem;
  line-height: 1;
}

.app-dock__tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  pointer-events: none;
  white-space: nowrap;
  border: 1px solid rgb(var(--border-subtle-rgb) / 0.16);
  border-radius: 0.6rem;
  background: rgb(var(--page-bg-rgb) / 0.92);
  padding: 0.3rem 0.5rem;
  color: var(--text-primary);
  font-size: 0.7rem;
  opacity: 0;
  transform: translate(-50%, 4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.app-dock__item:hover .app-dock__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.app-dock__panel {
  box-shadow: 0 18px 50px rgb(var(--shadow-rgb) / 0.42);
}

.dock-panel-enter-active,
.dock-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dock-panel-enter-from,
.dock-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (max-width: 640px) {
  .app-dock {
    bottom: max(0.75rem, env(safe-area-inset-bottom));
  }

  .app-dock__item {
    height: 44px;
    width: 44px;
  }

  .app-dock__item--create {
    height: 50px;
    width: 50px;
  }

  .app-dock__tooltip {
    display: none;
  }
}

@media (max-width: 380px) {
  .app-dock__bar {
    gap: 0.125rem;
    padding: 0.375rem;
  }

  .app-dock__item {
    height: 42px;
    width: 40px;
  }

  .app-dock__item--create {
    height: 46px;
    width: 46px;
    margin: 0 1px;
  }
}
</style>
