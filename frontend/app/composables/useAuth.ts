/**
 * Authentification : état utilisateur partagé (cookie HttpOnly `auth_token`
 * géré par le navigateur), et actions login/register/logout/fetchMe.
 */
export interface AuthUser {
  id: number
  email: string
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth:user', () => null)
  const initialized = useState<boolean>('auth:initialized', () => false)
  const pending = useState<boolean>('auth:pending', () => false)
  const store = useCollectionStore()

  async function fetchMe(): Promise<AuthUser | null> {
    pending.value = true
    try {
      const data = await $fetch<AuthUser>('/api/me', { credentials: 'include' })
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

  async function login(email: string, password: string): Promise<void> {
    await $fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      body: { email, password },
    })
    // L'état de l'utilisateur précédent ne doit jamais survivre au changement de session
    store.reset()
    await fetchMe()
  }

  async function register(email: string, password: string): Promise<void> {
    await $fetch('/api/register', {
      method: 'POST',
      credentials: 'include',
      body: { email, password },
    })
    await login(email, password)
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/api/logout', { method: 'POST', credentials: 'include' })
    } finally {
      user.value = null
      store.reset()
    }
  }

  return { user, initialized, pending, fetchMe, login, register, logout }
}
