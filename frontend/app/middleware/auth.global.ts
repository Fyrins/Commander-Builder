/**
 * Garde d'authentification globale : redirige vers /login si non connecté,
 * sauf sur les pages publiques (login, register).
 */
const PUBLIC_ROUTES = new Set(['/login', '/register'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, initialized, fetchMe } = useAuth()

  if (!initialized.value) {
    await fetchMe()
  }

  // Normaliser le slash final : en build statique, les routes sont `/register/`
  const path = to.path.replace(/\/+$/, '') || '/'
  const isPublic = PUBLIC_ROUTES.has(path)

  if (!user.value && !isPublic) {
    return navigateTo('/login')
  }

  if (user.value && isPublic) {
    return navigateTo('/')
  }
})
