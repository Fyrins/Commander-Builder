<script setup lang="ts">
defineProps<{ percent: number; label?: string }>()
</script>

<template>
  <div>
    <div v-if="label" class="mb-1 flex justify-between text-sm text-muted">
      <span>{{ label }}</span>
      <span>{{ Math.round(percent) }}%</span>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full surface-alt">
      <div
        class="h-full rounded-full bg-emerald-500 transition-all duration-300"
        :style="{ width: `${Math.min(100, Math.max(0, percent))}%` }"
      />
    </div>
  </div>
</template>
