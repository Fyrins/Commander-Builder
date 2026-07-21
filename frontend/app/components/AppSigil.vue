<script setup lang="ts">
/**
 * Sigil de la marque : couronne géométrique minimaliste dessinée pour
 * Commander Builder (trois pointes + base, évoquant la royauté d'un
 * commandant). Création originale — aucun logo ou symbole Wizards.
 */
</script>

<template>
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" class="sigil">
    <!-- Couronne : base + trois pointes reliées, sertie d'un point central -->
    <path
      d="M5 22 L5 12 L11 17 L16 8 L21 17 L27 12 L27 22 Z"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linejoin="round"
      fill="none"
    />
    <path d="M5 25 L27 25" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    <circle cx="16" cy="19.5" r="1.4" fill="currentColor" />
  </svg>
</template>
