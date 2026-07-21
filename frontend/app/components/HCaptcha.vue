<script setup lang="ts">
/**
 * Widget hCaptcha. Charge le script hCaptcha à la demande (une seule fois),
 * rend le widget explicitement et expose le token via v-model. Le token est
 * remis à null en cas d'expiration ou d'erreur, et réinitialisable de
 * l'extérieur via la méthode exposée `reset()`.
 */
declare global {
  interface Window {
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
    }
    hcaptchaOnLoad?: () => void
  }
}

const token = defineModel<string | null>({ default: null })

const config = useRuntimeConfig()
const colorMode = useColorMode()
const container = ref<HTMLElement | null>(null)
const widgetId = ref<string | null>(null)

const SCRIPT_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=hcaptchaOnLoad'
let loadPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.hcaptcha) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    window.hcaptchaOnLoad = () => resolve()
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Échec du chargement de hCaptcha'))
    document.head.appendChild(script)
  })
  return loadPromise
}

async function renderWidget() {
  await loadScript()
  if (!container.value || !window.hcaptcha || widgetId.value !== null) return

  widgetId.value = window.hcaptcha.render(container.value, {
    sitekey: config.public.hcaptchaSiteKey,
    theme: colorMode.value === 'dark' ? 'dark' : 'light',
    callback: (response: string) => {
      token.value = response
    },
    'expired-callback': () => {
      token.value = null
    },
    'error-callback': () => {
      token.value = null
    },
  })
}

function reset() {
  token.value = null
  if (window.hcaptcha && widgetId.value !== null) {
    window.hcaptcha.reset(widgetId.value)
  }
}

defineExpose({ reset })

onMounted(() => {
  renderWidget().catch((error) => console.error('[hcaptcha]', error))
})
</script>

<template>
  <div ref="container" class="h-captcha" />
</template>
