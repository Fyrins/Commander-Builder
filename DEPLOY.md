# Déploiement O2Switch — commanderbuilder.fr

## Architecture

Le compte FTP est chrooté sur `~/commanderbuilder` — tous les chemins des workflows sont relatifs à ce dossier.

- **Front** : `commanderbuilder.fr` → statique Nuxt (`.output/public/`) déployé dans `commanderbuilder/www/` — le docroot du domaine doit pointer sur `~/commanderbuilder/www`
- **API** : sources Symfony déployées dans `commanderbuilder/api/` — ⚠️ le docroot du sous-domaine `api.commanderbuilder.fr` doit pointer sur `~/commanderbuilder/api/public` (JAMAIS sur `api/` directement : cela exposerait `.env.local`, `config/`, `var/` au public). Un `.htaccess` Symfony est fourni dans `public/`.
- Cookie JWT : les deux hôtes sont same-site → le cookie `auth_token` posé par l'API est envoyé par le navigateur sans configuration particulière.

## Déploiement (SSH + rsync, automatique)

Les workflows GitHub Actions déploient en **SSH/rsync** (transfert fiable, sans les coupures du FTPS) et lancent **automatiquement** `composer install`, les migrations et le cache après chaque push sur `main`. Aucune manipulation manuelle après un déploiement.

### Secrets / variables GitHub

- Secrets SSH : `SSH_PRIVATE_KEY` (clé privée de déploiement), `SSH_HOST`, `SSH_USER` (`real5062`), `SSH_PORT`.
- Variable `HCAPTCHA_SITE_KEY` : clé de site hCaptcha (publique), utilisée au build du front. Sans elle, le build utilise la clé de test.
- Variables optionnelles : `FRONTEND_SSH_DIR` (défaut `commanderbuilder/www`), `API_SSH_DIR` (défaut `commanderbuilder/api`), relatifs au home SSH.

### Configuration SSH (une seule fois)

1. Générer une paire de clés de déploiement (`ssh-keygen -t ed25519`), poser la **clé privée** dans le secret GitHub `SSH_PRIVATE_KEY`.
2. Ajouter la **clé publique** dans `~/.ssh/authorized_keys` sur le serveur O2Switch (cPanel → SSH Access → Manage SSH Keys → Import/Authorize).
3. Renseigner les secrets `SSH_HOST` (hôte SSH O2Switch), `SSH_USER` (`real5062`), `SSH_PORT` (port SSH O2Switch).
4. rsync exclut `.env.local`, `config/jwt/`, `var/`, `vendor/` : ils ne sont ni transférés ni supprimés sur le serveur.

## hCaptcha

Protège l'inscription et la connexion (actif en production uniquement). Créer une paire de clés sur hcaptcha.com pour le domaine `commanderbuilder.fr`, puis :
- Front : variable de dépôt GitHub `HCAPTCHA_SITE_KEY` (clé de site, publique).
- API : `HCAPTCHA_SECRET` dans le `.env.local` de prod (clé secrète).

⚠️ Les deux clés doivent être **réelles et appariées**. Si l'on laisse les clés de test en production, le widget accepte tout le monde (les clés de test valident n'importe quel token) : la protection est alors inopérante. Le couple site/secret réel doit provenir du même compte hCaptcha.

## Prérequis serveur (une seule fois, déjà faits)

1. **Sous-domaine** : `api.commanderbuilder.fr` avec racine `~/commanderbuilder/api/public` (JAMAIS `api/` directement). AutoSSL sur le domaine ET le sous-domaine.
2. **MySQL** : base + utilisateur dédié en `utf8mb4`. Mot de passe **sans caractères spéciaux** (évite l'URL-encoding et l'échappement `%%` dans `DATABASE_URL`).
3. **`.env.local`** dans `~/commanderbuilder/api/` (jamais versionné ni écrasé par les déploiements). Modèle : `.env.local.example`. Contenu :
   ```
   APP_ENV=prod
   APP_SECRET=<64 hex aléatoires : openssl rand -hex 32>
   DATABASE_URL="mysql://USER:PASS@127.0.0.1:3306/BASE?serverVersion=mariadb-11.4.12&charset=utf8mb4"
   CORS_ALLOW_ORIGIN='^https://commanderbuilder\.fr$'
   JWT_COOKIE_SECURE=true
   HCAPTCHA_SECRET=<clé secrète hCaptcha>
   ```
   Ajuster `serverVersion` à la version réelle (`SELECT VERSION();`).
4. **Clés JWT** : `php bin/console lexik:jwt:generate-keypair --skip-if-exists` (une fois ; le dossier `config/jwt/` est exclu des déploiements, donc conservé).

Après ça, chaque push sur `main` déclenche le déploiement complet automatiquement (rsync + composer + migrations + cache). Les jobs `smoke-test` valident homepage, manifest, HTTPS et endpoints.

## Préchauffage du cache (optionnel, recommandé)

La commande `app:warm-cache` pré-remplit les caches globaux (`card` + `oracle_price`) avec les cartes staples du top EDHREC, pour que la liste des decks et les budgets « meilleur prix » soient rapides dès le premier chargement. Idempotente (ne touche Scryfall que pour ce qui manque/est périmé).

- Manuel : `php bin/console app:warm-cache --commanders=60 --min-decks=5`
- Cron cPanel nocturne (exemple, 4h) : `0 4 * * * cd ~/commanderbuilder/api && php bin/console app:warm-cache >/dev/null 2>&1`

## Déploiements suivants

Push sur `main` → tout est automatique. Deux cas demandent un passage terminal cPanel (le workflow l'affiche dans ses logs) :
- `composer.lock` modifié → `composer install` + cache clear/warmup
- nouvelles migrations → `doctrine:migrations:migrate`

## Rappels légaux (Fan Content Policy)

L'app doit rester **gratuite** (pas de paywall), afficher le disclaimer « unofficial Fan Content » (footer) et ne jamais utiliser les logos Wizards comme identité propre.
