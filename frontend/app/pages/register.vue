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
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
    <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 class="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Créer un compte</h1>
      <p class="mb-6 text-sm text-slate-500 dark:text-slate-400">Gérez votre collection et vos decks Commander.</p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label for="username" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Pseudonyme</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            autocomplete="username"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
        </div>
        <div>
          <label for="passwordConfirm" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirmer le mot de passe</label>
          <input
            id="passwordConfirm"
            v-model="passwordConfirm"
            type="password"
            required
            autocomplete="new-password"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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

      <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Déjà un compte ?
        <NuxtLink to="/login" class="font-medium text-slate-900 underline dark:text-white">Se connecter</NuxtLink>
      </p>
    </div>
  </div>
</template>
