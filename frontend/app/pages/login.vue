<script setup lang="ts">
definePageMeta({ layout: false })

const { login } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const pending = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  pending.value = true
  try {
    await login(username.value, password.value)
    await router.push('/')
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    errorMessage.value = status === 401 ? 'Pseudonyme ou mot de passe incorrect.' : 'Une erreur est survenue. Réessayez.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
    <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 class="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Connexion</h1>
      <p class="mb-6 text-sm text-slate-500 dark:text-slate-400">Accédez à votre collection Magic.</p>

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
            autocomplete="current-password"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
        </div>

        <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="pending"
          class="btn btn--primary w-full py-2"
        >
          {{ pending ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Pas encore de compte ?
        <NuxtLink to="/register" class="font-medium text-slate-900 underline dark:text-white">Créer un compte</NuxtLink>
      </p>
    </div>
  </div>
</template>
