<script setup lang="ts">
import { computed } from 'vue'
import { parseManaString } from '~/utils/mana'

const props = defineProps<{ text: string | null | undefined }>()

const segments = computed(() => parseManaString(props.text ?? ''))
</script>

<template>
  <p v-if="text" class="whitespace-pre-line">
    <template v-for="(segment, index) in segments" :key="index">
      <ManaSymbol v-if="segment.type === 'symbol'" :code="segment.code" />
      <template v-else>{{ segment.value }}</template>
    </template>
  </p>
</template>
