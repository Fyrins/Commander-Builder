/**
 * Authentification : état utilisateur partagé (cookie HttpOnly `auth_token`
 * géré par le navigateur), et actions login/register/logout/fetchMe.
 */
export interface AuthUser {
  id: number
  username: string
}

export function useAuth() {
  const api = useApi()
  const user = useState<AuthUser | null>('auth:user', () => null)
  const initialized = useState<boolean>('auth:initialized', () => false)
  const pending = useState<boolean>('auth:pending', () => false)
  const store = useCollectionStore()

  async function fetchMe(): Promise<AuthUser | null> {
    pending.value = true
    try {
      const data = await api<AuthUser>('/me', { credentials: 'include' })
      user.value = data
      return data
    } catch {
      user.value = null
      return null
    } finally {
      initialized.value = true
      pending.value = false
    }
  }

  async function login(username: string, password: string, hcaptchaToken?: string | null): Promise<void> {
    await api('/login', {
      method: 'POST',
      credentials: 'include',
      body: { username, password, hcaptchaToken },
    })
    // L'état de l'utilisateur précédent ne doit jamais survivre au changement de session
    store.reset()
    await fetchMe()
  }

  async function register(username: string, password: string, hcaptchaToken?: string | null): Promise<void> {
    // L'inscription pose directement le cookie JWT (auto-login côté serveur) :
    // pas de second appel /api/login, donc un seul token hCaptcha nécessaire.
    await api('/register', {
      method: 'POST',
      credentials: 'include',
      body: { username, password, hcaptchaToken },
    })
    store.reset()
    await fetchMe()
  }

  async function logout(): Promise<void> {
    try {
      await api('/logout', { method: 'POST', credentials: 'include' })
    } finally {
      user.value = null
      store.reset()
    }
  }

  return { user, initialized, pending, fetchMe, login, register, logout }
}
