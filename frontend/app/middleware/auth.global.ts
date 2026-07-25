/**
 * Garde d'authentification globale.
 * - `/` (landing), `/login`, `/register` sont publiques.
 * - Non connecté sur une route protégée → /login.
 * - Connecté sur la landing → /inventaire (son accueil applicatif).
 */
const PUBLIC_ROUTES = new Set(['/', '/login', '/register'])

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

  // Un utilisateur connecté qui atterrit sur la landing ou l'auth → son inventaire.
  if (user.value && (path === '/' || path === '/login' || path === '/register')) {
    return navigateTo('/inventaire')
  }
})
