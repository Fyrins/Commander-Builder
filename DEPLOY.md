# Déploiement O2Switch — commanderbuilder.fr

## Architecture

Le compte FTP est chrooté sur `~/commanderbuilder` — tous les chemins des workflows sont relatifs à ce dossier.

- **Front** : `commanderbuilder.fr` → statique Nuxt (`.output/public/`) déployé dans `commanderbuilder/www/` — le docroot du domaine doit pointer sur `~/commanderbuilder/www`
- **API** : sources Symfony déployées dans `commanderbuilder/api/` — ⚠️ le docroot du sous-domaine `api.commanderbuilder.fr` doit pointer sur `~/commanderbuilder/api/public` (JAMAIS sur `api/` directement : cela exposerait `.env.local`, `config/`, `var/` au public). Un `.htaccess` Symfony est fourni dans `public/`.
- Cookie JWT : les deux hôtes sont same-site → le cookie `auth_token` posé par l'API est envoyé par le navigateur sans configuration particulière.

## Secrets / variables GitHub

- Secrets (faits) : `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD`
- Variable `HCAPTCHA_SITE_KEY` : clé de site hCaptcha (publique), utilisée au build du front. Sans elle, le build utilise la clé de test.
- Variables optionnelles : `FRONTEND_DIR` (défaut `./www/`), `API_DIR` (défaut `./api/`) — à créer seulement si l'arborescence FTP diffère.

## hCaptcha

Protège l'inscription et la connexion (actif en production uniquement). Créer une paire de clés sur hcaptcha.com pour le domaine `commanderbuilder.fr`, puis :
- Front : variable de dépôt GitHub `HCAPTCHA_SITE_KEY` (clé de site, publique).
- API : `HCAPTCHA_SECRET` dans le `.env.local` de prod (clé secrète). Sans cette clé réelle, la vérification échouera en prod (les clés de test ne valident que les tokens de test).

## Premier déploiement — étapes manuelles cPanel (une seule fois)

1. **Sous-domaine** : créer `api.commanderbuilder.fr` avec racine `~/commanderbuilder/api/public` (le dossier sera rempli par le workflow ; créer le dossier vide d'abord si cPanel l'exige). Vérifier que l'AutoSSL couvre le domaine ET le sous-domaine.
2. **MySQL** : créer une base + un utilisateur dédié (tout en `utf8mb4`), noter les identifiants.
3. **Pousser sur `main`** (merge de develop) → les deux workflows uploadent front et API.
4. **Terminal cPanel** — dans `~/commanderbuilder/api/` :
   ```bash
   # .env.local de prod (jamais uploadé par le workflow)
   cat > .env.local <<'EOF'
   APP_ENV=prod
   APP_SECRET=<64 hex aléatoires>
   DATABASE_URL="mysql://USER:PASS@127.0.0.1:3306/BASE?serverVersion=10.11.0-MariaDB&charset=utf8mb4"
   CORS_ALLOW_ORIGIN='^https://commanderbuilder\.fr$'
   JWT_COOKIE_SECURE=true
   HCAPTCHA_SECRET=<clé secrète hCaptcha>
   EOF
   composer install --no-dev --optimize-autoloader
   php bin/console lexik:jwt:generate-keypair --skip-if-exists
   php bin/console doctrine:migrations:migrate --no-interaction
   php bin/console cache:clear && php bin/console cache:warmup
   ```
   Note : ajuster `serverVersion` à la version MySQL/MariaDB réelle d'O2Switch (`SELECT VERSION();`).
5. **Cookie sécurisé** : piloté par `JWT_COOKIE_SECURE` (défaut `false` en dev, `true` posé dans le `.env.local` de prod ci-dessus). Rien d'autre à faire.
6. **Smoke test** : les jobs `smoke-test` des workflows valident automatiquement homepage, manifest PWA, HTTPS et protection des endpoints.

## Déploiements suivants

Push sur `main` → tout est automatique. Deux cas demandent un passage terminal cPanel (le workflow l'affiche dans ses logs) :
- `composer.lock` modifié → `composer install` + cache clear/warmup
- nouvelles migrations → `doctrine:migrations:migrate`

## Rappels légaux (Fan Content Policy)

L'app doit rester **gratuite** (pas de paywall), afficher le disclaimer « unofficial Fan Content » (footer) et ne jamais utiliser les logos Wizards comme identité propre.
