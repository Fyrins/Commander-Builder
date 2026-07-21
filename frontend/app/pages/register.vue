<script setup lang="ts">
definePageMeta({ layout: false })

const { register } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const passwordConfirm = ref('')
const errorMessage = ref('')
const pending = ref(false)

async function handleSubmit() {
  errorMessage.value = ''

  if (password.value !== passwordConfirm.value) {
    errorMessage.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  pending.value = true
  try {
    await register(username.value, password.value)
    await router.push('/')
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      errorMessage.value = 'Ce pseudonyme est déjà utilisé.'
    } else {
      const message = (error as { data?: { error?: string } })?.data?.error
      errorMessage.value = status === 400 && message ? message : 'Une erreur est survenue. Réessayez.'
    }
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center surface-alt px-4 ">
    <div class="w-full max-w-sm panel p-8 shadow-sm  ">
      <h1 class="mb-1 text-xl font-semibold text-strong">Créer un compte</h1>
      <p class="mb-6 text-sm text-muted">Gérez votre collection et vos decks Commander.</p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label for="username" class="mb-1 block text-sm font-medium text-muted">Pseudonyme</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            autocomplete="username"
            class="field"
          >
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-muted">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            class="field"
          >
        </div>
        <div>
          <label for="passwordConfirm" class="mb-1 block text-sm font-medium text-muted">Confirmer le mot de passe</label>
          <input
            id="passwordConfirm"
            v-model="passwordConfirm"
            type="password"
            required
            autocomplete="new-password"
            class="field"
          >
        </div>

        <p class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Aucune adresse email n'est collectée : si tu perds ton mot de passe, le compte ne pourra pas être récupéré.
          Choisis un mot de passe que tu sauras retrouver (gestionnaire de mots de passe recommandé).
        </p>

        <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="pending"
          class="btn btn--primary w-full py-2"
        >
          {{ pending ? 'Création…' : 'Créer mon compte' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted">
        Déjà un compte ?
        <NuxtLink to="/login" class="font-medium text-strong underline ">Se connecter</NuxtLink>
      </p>
    </div>
  </div>
</template>
