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

  const isPublic = PUBLIC_ROUTES.has(to.path)

  if (!user.value && !isPublic) {
    return navigateTo('/login')
  }

  if (user.value && isPublic) {
    return navigateTo('/')
  }
})
