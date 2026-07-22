<script setup lang="ts">
definePageMeta({ layout: false })

const { login } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const captchaToken = ref<string | null>(null)
const captcha = ref<{ reset: () => void } | null>(null)
const errorMessage = ref('')
const pending = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  pending.value = true
  try {
    await login(username.value, password.value, captchaToken.value)
    await router.push('/')
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 429) errorMessage.value = 'Trop de tentatives. Réessayez dans une minute.'
    else if (status === 400) errorMessage.value = 'Vérification anti-robot échouée. Merci de recommencer.'
    else if (status === 401) errorMessage.value = 'Pseudonyme ou mot de passe incorrect.'
    else errorMessage.value = 'Une erreur est survenue. Réessayez.'
    captcha.value?.reset()
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center surface-alt px-4 ">
    <div class="w-full max-w-sm panel p-8 shadow-sm  ">
      <h1 class="mb-1 text-xl font-semibold text-strong">Connexion</h1>
      <p class="mb-6 text-sm text-muted">Accédez à votre collection Magic.</p>

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
            autocomplete="current-password"
            class="field"
          >
        </div>

        <HCaptcha ref="captcha" v-model="captchaToken" />

        <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="pending"
          class="btn btn--primary w-full py-2"
        >
          {{ pending ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?
        <NuxtLink to="/register" class="font-medium text-strong underline ">Créer un compte</NuxtLink>
      </p>
    </div>
  </div>
</template>
