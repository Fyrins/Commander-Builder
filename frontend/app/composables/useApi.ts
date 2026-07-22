/**
 * Client HTTP configuré pour l'API : préfixe toutes les requêtes par
 * `runtimeConfig.public.apiBase` (proxy `/api` en dev, URL complète de l'API en
 * prod) et joint le cookie d'auth. À utiliser à la place de `$fetch` pour tout
 * appel à l'API — sinon les chemins relatifs `/api/...` visent l'origine du
 * front (correct en dev via le proxy, mais 404 en prod où l'API est sur un
 * sous-domaine).
 */
export function useApi() {
  const config = useRuntimeConfig()
  return $fetch.create({
    baseURL: config.public.apiBase,
    credentials: 'include',
  })
}
