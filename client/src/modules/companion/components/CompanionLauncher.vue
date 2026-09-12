<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const visible = computed(() => route.meta.auth && route.name !== 'companion')
</script>

<template>
  <router-link v-if="visible" :to="{ name: 'companion' }" class="companion-launcher group" aria-label="打开心语陪伴" title="心语陪伴">
    <span class="companion-launcher__halo" aria-hidden="true" />
    <span class="companion-launcher__icon" aria-hidden="true">☾</span>
    <span class="companion-launcher__label">想说说话？</span>
  </router-link>
</template>

<style scoped>
.companion-launcher {
  position: fixed;
  right: 1.25rem;
  bottom: 1.5rem;
  z-index: 45;
  display: flex;
  height: 3.25rem;
  align-items: center;
  gap: 0.55rem;
  overflow: hidden;
  border: 1px solid rgb(var(--accent-rgb) / 0.42);
  border-radius: 999px;
  background: rgb(var(--page-bg-rgb) / 0.8);
  padding: 0 0.9rem 0 0.75rem;
  color: var(--text-primary);
  box-shadow: 0 10px 30px rgb(var(--shadow-rgb) / 0.3), 0 0 22px rgb(var(--accent-rgb) / 0.16);
  backdrop-filter: blur(18px) saturate(1.2);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.companion-launcher:hover,
.companion-launcher:focus-visible {
  border-color: rgb(var(--accent-rgb) / 0.8);
  box-shadow: 0 14px 36px rgb(var(--shadow-rgb) / 0.38), 0 0 28px rgb(var(--accent-rgb) / 0.3);
  outline: none;
  transform: translateY(-3px);
}

.companion-launcher__halo {
  position: absolute;
  top: 50%;
  left: 0.9rem;
  height: 1.75rem;
  width: 1.75rem;
  border-radius: 999px;
  background: rgb(var(--accent-rgb) / 0.22);
  filter: blur(2px);
  transform: translateY(-50%);
}

.companion-launcher__icon,
.companion-launcher__label {
  position: relative;
}

.companion-launcher__icon {
  color: var(--accent-text);
  font-size: 1.3rem;
  line-height: 1;
}

.companion-launcher__label {
  font-size: 0.78rem;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .companion-launcher {
    right: 0.9rem;
    bottom: calc(6.1rem + env(safe-area-inset-bottom));
    height: 3rem;
    padding-right: 0.75rem;
  }

  .companion-launcher__label {
    font-size: 0.72rem;
  }
}
</style>
