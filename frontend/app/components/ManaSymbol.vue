<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveManaSymbol } from '~/utils/mana'

const props = defineProps<{ code: string }>()

const meta = computed(() => resolveManaSymbol(props.code))

const classes = computed(() => {
  const list = ['mana', `mana--${meta.value.modifier}`]
  if (meta.value.colorModifier) list.push(`mana--${meta.value.colorModifier}`)
  return list
})

const style = computed(() => {
  if (!meta.value.colors) return undefined
  const [colorA, colorB] = meta.value.colors
  return { '--mana-color-a': colorA, '--mana-color-b': colorB }
})

/** Code Scryfall sans accolades ni slash, ex. `{G/W}` → `GW`, `{2/U}` → `2U`. */
const svgCode = computed(() => props.code.toUpperCase().replace('/', ''))
const svgUrl = computed(() => `https://svgs.scryfall.io/card-symbols/${svgCode.value}.svg`)

// Le disque CSS BEM sert de repli si l'image officielle échoue à charger.
const svgFailed = ref(false)
watch(() => props.code, () => { svgFailed.value = false })
</script>

<template>
  <span :class="classes" :style="style" :title="`{${code}}`">
    <img
      v-if="!svgFailed"
      :src="svgUrl"
      :alt="`{${code}}`"
      loading="lazy"
      class="mana__image"
      @error="svgFailed = true"
    >
    <span v-else class="mana__value">{{ meta.label }}</span>
  </span>
</template>
