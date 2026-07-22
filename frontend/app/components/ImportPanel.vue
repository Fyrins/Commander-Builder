<script setup lang="ts">
const store = useCollectionStore()

const isDragging = ref(false)
const csvErrors = ref<string[]>([])
const csvBusy = ref(false)
const csvSuccess = ref('')

const deckName = ref('')
const deckText = ref('')
const deckIsOwned = ref(true)
const deckErrors = ref<string[]>([])
const deckBusy = ref(false)
const deckSuccess = ref('')

async function handleFiles(files: FileList | null) {
  const file = files?.[0]
  if (!file) return

  csvBusy.value = true
  csvErrors.value = []
  csvSuccess.value = ''
  try {
    const result = await store.importCsv(file)
    csvErrors.value = result.errors
    if (result.count > 0) {
      csvSuccess.value = `${result.count} ligne(s) importée(s).`
    }
  } finally {
    csvBusy.value = false
  }
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  handleFiles(event.dataTransfer?.files ?? null)
}

function onFileInput(event: Event) {
  const target = event.target as HTMLInputElement
  handleFiles(target.files)
  target.value = ''
}

async function submitDeck() {
  if (!deckName.value.trim() || !deckText.value.trim()) return

  deckBusy.value = true
  deckErrors.value = []
  deckSuccess.value = ''
  try {
    const result = await store.importDeck(deckName.value.trim(), deckText.value, deckIsOwned.value)
    deckErrors.value = result.errors
    if (result.count > 0) {
      deckSuccess.value = `${result.count} carte(s) importée(s) dans « ${deckName.value.trim()} ».`
      deckName.value = ''
      deckText.value = ''
    }
  } finally {
    deckBusy.value = false
  }
}
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2">
    <div
      class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors"
      :class="isDragging ? 'hairline-strong surface-alt' : 'hairline-strong'"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <p class="mb-2 font-medium text-strong">Collection (CSV ManaBox)</p>
      <p class="mb-4 text-sm text-muted">
        Glissez-déposez votre export ManaBox ici, ou choisissez un fichier. Remplace intégralement la collection actuelle.
      </p>
      <label class="btn btn--secondary cursor-pointer py-2">
        {{ csvBusy ? 'Import en cours…' : 'Choisir un fichier' }}
        <input type="file" accept=".csv,text/csv" class="hidden" :disabled="csvBusy" @change="onFileInput">
      </label>
      <p v-if="csvSuccess" class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{{ csvSuccess }}</p>
      <ul v-if="csvErrors.length" class="mt-4 max-h-32 w-full overflow-y-auto rounded-md bg-red-50 p-3 text-left text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
        <li v-for="(err, index) in csvErrors" :key="index">{{ err }}</li>
      </ul>
    </div>

    <div class="panel p-6 ">
      <p class="mb-2 font-medium text-strong">Ajouter une decklist</p>
      <p class="mb-4 text-sm text-muted">Collez une decklist texte (une carte par ligne).</p>

      <div class="space-y-3">
        <input
          v-model="deckName"
          type="text"
          placeholder="Nom du deck"
          class="field"
        >
        <textarea
          v-model="deckText"
          rows="6"
          placeholder="1 Sol Ring&#10;1 Atraxa, Praetors' Voice (C16) 1"
          class="field font-mono text-xs"
        />
        <label class="flex items-center gap-2 text-sm text-muted">
          <input v-model="deckIsOwned" type="checkbox" class="mtg-checkbox">
          Deck que je possède physiquement
        </label>
        <button
          type="button"
          :disabled="deckBusy || !deckName.trim() || !deckText.trim()"
          class="btn btn--primary w-full py-2"
          @click="submitDeck"
        >
          {{ deckBusy ? 'Import en cours…' : 'Ajouter le deck' }}
        </button>
      </div>

      <p v-if="deckSuccess" class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{{ deckSuccess }}</p>
      <ul v-if="deckErrors.length" class="mt-3 max-h-32 overflow-y-auto rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
        <li v-for="(err, index) in deckErrors" :key="index">{{ err }}</li>
      </ul>
    </div>
  </div>
</template>
