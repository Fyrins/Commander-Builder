<script setup lang="ts">
/**
 * Ancienne URL de la page EDHREC, conservée pour compatibilité (liens
 * existants, favoris) : redirige vers /decks en conservant le paramètre
 * `commander` s'il est présent, pour ouvrir directement la fiche du deck.
 */
const route = useRoute()

const query = typeof route.query.commander === 'string' && route.query.commander ? { commander: route.query.commander } : undefined

await navigateTo({ path: '/decks', query }, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
