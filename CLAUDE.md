# Commander Builder

Application web multi-utilisateurs : importer sa collection Magic (export ManaBox CSV) et ses decklists, détecter les commandants jouables, mesurer la complétion de n'importe quelle decklist (comparateur + deck moyen EDHREC = liste d'achat priorisée).

## Stack (modèle : ~/Sites/pedago-muso)

- `frontend/` — Nuxt 4, TypeScript, SPA (`ssr: false`), Tailwind CSS 4 (@tailwindcss/vite), reka-ui, @nuxtjs/color-mode, @vite-pwa/nuxt, Vitest.
- `api/` — Symfony 7.4, API Platform 4.3, Doctrine ORM (MySQL `mtg_builder` en local), lexik JWT (cookie HttpOnly `auth_token` + Bearer fallback), nelmio CORS.
- Déploiement cible : O2Switch (mutualisé) via GitHub Actions FTPS — front en `nuxt generate`, API en sources + `composer install`.

## Architecture — règles à respecter

- **Moteur pur** dans `frontend/lib/engine/` : parsing CSV/decklist, terrains de base, fusion inventaire, scoring, commandants, slug EDHREC. Zéro dépendance Nuxt/réseau, tout est testé par Vitest (`npm run test` dans frontend/).
- **Matching des cartes** : clé primaire `oracle_id` Scryfall (insensible à la langue FR/EN), repli `set + collector_number`. Jamais de fuzzy matching sur les noms.
- **Catalogue** : aucune donnée carte embarquée. Résolution via Scryfall `POST /cards/collection` (batch 75, throttle 100 ms), cache partagé dans la table `cards`. Le client découpe ses requêtes `POST /api/cards/resolve` en paquets ≤ 300 identifiants.
- **Terrains de base toujours considérés comme possédés** (hypothèse : tout joueur a un pool de terrains suffisant). Ils comptent dans le % de complétion (numérateur et dénominateur) mais n'apparaissent jamais dans les manquantes ni les budgets d'achat. Détection EN/FR/enneigés via `type_line` ou repli nom.
- **Images** : jamais stockées — hotlink des `image_uris` Scryfall (small/normal), lazy-loading.
- **EDHREC** : pas d'API officielle — `https://json.edhrec.com/pages/commanders/<slug>.json` proxifié par `GET /api/edhrec/{slug}` (pas de CORS chez EDHREC).

## Commandes

- API : `cd api && symfony server:start --port=8000` ; migrations `php bin/console doctrine:migrations:migrate`.
- Front : `cd frontend && npm run dev` (port 3000) ; tests `npm run test`.
- Seed données d'Alexandre : `php bin/console app:seed-fixtures` (depuis `data/fixtures/`).

## Données de test

`data/fixtures/collection.csv` (export ManaBox réel, 705 lignes, ~916 cartes, langue fr) + `data/fixtures/decks/*.txt` (8 decklists possédées, format `N Nom (SET) collecteur [*F*]`). Servent aux tests Vitest (lues via node:fs) et au seed.

## Conventions

- Commits Conventional Commits en anglais, branches `feat/*` (jamais de commit direct sur main — hook bloquant).
- Communication et documentation en français.
- `composer.json` / `package.json` : jamais d'édition manuelle, toujours via `composer require` / `npm install` / `npm pkg set`.

## Repo public — règles de commit

Le repo est public (collecte de suggestions/bugs via issues, doc via wiki). Ne JAMAIS commiter :
- données personnelles (emails, prix d'achat, exports bruts non anonymisés) — les fixtures doivent rester anonymisées ;
- identifiants, tokens, mots de passe réels (les mots de passe de seed/test locaux sont tolérés mais ne doivent jamais servir en prod) ;
- chemins serveur absolus ou noms d'utilisateur d'hébergement (écrire `~/commanderbuilder`) ;
- captures d'écran contenant des données d'autres utilisateurs.
En cas de doute, passer par un secret GitHub ou une variable d'environnement.
