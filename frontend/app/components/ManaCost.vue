<script setup lang="ts">
import { computed } from 'vue'
import { parseManaString } from '~/utils/mana'

const props = defineProps<{ cost: string | null | undefined }>()

const segments = computed(() => parseManaString(props.cost ?? ''))
</script>

<template>
  <span v-if="cost" class="inline-flex flex-wrap items-center gap-0.5">
    <template v-for="(segment, index) in segments" :key="index">
      <ManaSymbol v-if="segment.type === 'symbol'" :code="segment.code" />
      <span v-else>{{ segment.value }}</span>
    </template>
  </span>
</template>
