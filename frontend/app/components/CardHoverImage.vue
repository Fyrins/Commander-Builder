<script setup lang="ts">
defineProps<{ small?: string | null; normal?: string | null; alt: string }>()
</script>

<template>
  <span class="group relative inline-block shrink-0">
    <img
      v-if="small"
      :src="small"
      :alt="alt"
      loading="lazy"
      class="h-14 w-auto rounded shadow-sm ring-1 ring-black/10 dark:ring-white/10"
    >
    <span
      v-else
      class="flex h-14 w-10 items-center justify-center rounded surface-alt text-[10px] text-muted "
    >
      —
    </span>
    <span
      v-if="normal"
      class="pointer-events-none absolute left-1/2 top-full z-50 hidden -translate-x-1/2 pt-2 group-hover:block"
    >
      <img :src="normal" :alt="alt" class="w-64 rounded-lg shadow-2xl ring-1 ring-black/20 dark:ring-white/10">
    </span>
  </span>
</template>
