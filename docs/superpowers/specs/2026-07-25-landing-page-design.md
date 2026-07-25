# Landing page publique — Commander Builder

## Contexte

Le site est en ligne (commanderbuilder.fr) mais `/` est l'Inventaire, protégé : un
visiteur non connecté est redirigé vers `/login`. Il n'existe aucune page publique
présentant le produit. On ajoute une **landing** publique à la racine, avec des
captures d'écran réelles du compte de démonstration (alex : 916 cartes, 8 decks),
pour donner envie de créer un compte avant l'ouverture publique.

## Routing

- `/` → nouvelle **landing publique**.
- L'Inventaire actuel (`app/pages/index.vue`) est déplacé vers **`/inventaire`**
  (`app/pages/inventaire.vue`), contenu inchangé.
- `app/middleware/auth.global.ts` :
  - `PUBLIC_ROUTES` inclut `/` (+ `/login`, `/register`).
  - Un visiteur **connecté** arrivant sur `/` est redirigé vers `/inventaire`.
  - Un visiteur **non connecté** sur une route protégée reste redirigé vers `/login`.
- Redirections d'auth : après login/register réussis → `/inventaire` (au lieu de `/`).
- Layout `default.vue` : le lien de nav « Inventaire » pointe vers `/inventaire`.
  La landing utilise un layout minimal (header + footer, sans la nav applicative)
  ou `layout: false` avec son propre header/footer.

## Structure de la landing (`app/pages/index.vue`)

Design **Grimoire arcanique** existant (tokens `--ink-*`, `--gold`, Cinzel/Alegreya,
classes `.btn`, `.panel`, `AppSigil`). Responsive, clair/sombre.

1. **Header** : `AppSigil` + « Commander Builder » (Cinzel). À droite : `Se connecter`
   (`.btn--secondary`) et `Créer un compte` (`.btn--primary`). Si l'utilisateur est
   déjà connecté (cas limite avant redirection), afficher `Ouvrir mon inventaire`.
2. **Hero** : titre gravé + accroche (« Sais quels commandants tu peux jouer, et
   complète tes decks au meilleur prix. »), sous-titre court, CTA principal
   (`Créer un compte`), grande capture de la **vue Decks**.
3. **4 sections produit** (texte + capture, alternées gauche/droite) :
   1. **Importe ta collection** — export ManaBox, inventaire fusionné, répartition
      par identité de couleur. → capture Inventaire.
   2. **Tes commandants jouables** — détection automatique dans le pool. → capture
      Commandants.
   3. **Compare n'importe quel deck** — % de complétion + cartes manquantes
      chiffrées à l'édition la moins chère. → capture Comparateur (avec résultat).
   4. **Explore les decks** — classement par compatibilité + stats (courbe de mana,
      couleurs) + budget d'achat priorisé. → capture Decks + fiche/stats.
4. **Réassurance** : « Gratuit, sans email — juste un pseudo » (anonymat/RGPD).
5. **CTA final** (`Créer un compte`) + **footer** existant (disclaimer Fan Content
   Policy + crédits Scryfall/EDHREC).

## Captures d'écran

- Générées **en local** via un script Playwright (`tools/screenshots.mjs`),
  connecté au compte seedé `alex` (voir `tools/seed.ts`), thème **sombre**,
  viewport large fixe (ex. 1440×900) pour un cadrage cohérent.
- Prérequis au run : API (`:8000`) + front dev (`:3000`) + seed lancés.
- Vues capturées : `inventaire`, `commandants`, `comparateur` (avec un deck comparé),
  `decks` (classement), `deck-detail` (stats).
- Sortie : `frontend/public/screenshots/*.webp` (ou `.png`), optimisées, référencées
  en chemins statiques (`/screenshots/...`), `loading="lazy"`.
- Playwright installé en devDependency (`npm install -D playwright`), script hors du
  build (aucun impact sur le bundle).

## Transverse

- **SEO / partage** : `useSeoMeta` sur la landing (title, description, og:title,
  og:description, og:image = une capture). `htmlAttrs.lang=fr` déjà en place.
- **Aucune ressource externe** (CSP PWA) : captures self-hébergées, pas de CDN.
- **Légal** : « Magic: The Gathering » uniquement en description (usage de référence) ;
  footer disclaimer conservé ; aucun logo/branding Wizards.
- **Tests** : le moteur (`lib/engine`) n'est pas touché → suite Vitest inchangée
  (100 verts). Vérif build `npm run generate` + contrôle visuel de la landing en
  clair/sombre.

## Hors périmètre (YAGNI)

- Pas de blog, pas de page « à propos » séparée, pas de i18n, pas d'analytics.
- Pas d'animation lourde au-delà de la séquence d'apparition existante
  (`anim-stagger` / `prefers-reduced-motion` respecté).
