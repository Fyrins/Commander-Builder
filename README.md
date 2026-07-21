# Commander Builder

Application web pour joueurs de Magic: The Gathering au format Commander. Importez votre collection (export ManaBox) et vos decklists, puis l'outil vous indique quels commandants vous pouvez jouer et à quel point votre collection couvre n'importe quel deck, avec les cartes manquantes chiffrées et priorisées à l'achat.

Aucune donnée de carte n'est embarquée : tout est résolu via l'API Scryfall et mis en cache côté serveur, partagé entre les utilisateurs.

## Fonctionnalités

- **Inventaire** : collection ManaBox et decks montés fusionnés en un pool unique (case « inclure mes decks »), totaux et répartition par identité de couleur.
- **Mes commandants** : détection des commandants légaux réellement présents dans le pool (créature légendaire ou texte « can be your commander »), avec leur identité de couleur.
- **Comparateur** : un de vos decks ou une decklist collée, comparé au pool. Taux de complétion, cartes manquantes triées et chiffrées (prix Cardmarket via Scryfall), option « autres éditions » (matching par `oracle_id`, insensible à la langue), et détail des terrains de base à prévoir.
- **Decks** : les decks moyens EDHREC (vos commandants plus le top des commandants populaires) classés par compatibilité avec votre collection. Chaque deck ouvre une fiche détaillée avec statistiques (courbe de mana, coûts et production par couleur, répartition par type, probabilités de pioche), budget pour le compléter et liste d'achat priorisée.

Les terrains de base sont toujours comptés comme possédés (hypothèse : tout joueur en a assez), ils n'apparaissent donc jamais dans les cartes à acheter.

## Comptes

Inscription par pseudonyme uniquement, aucune adresse email n'est collectée. Conséquence : un mot de passe perdu ne peut pas être récupéré (l'écran d'inscription le rappelle).

## Stack

| | |
|---|---|
| Frontend | Nuxt 4 (SPA), TypeScript, Tailwind CSS 4, PWA |
| API | Symfony 7.4, API Platform, Doctrine (MySQL), JWT en cookie HttpOnly |
| Données cartes | API Scryfall (cache serveur partagé), prix Cardmarket via Scryfall, popularité via EDHREC |
| Déploiement | O2Switch (mutualisé), GitHub Actions FTPS |

Le moteur de matching (parsing CSV/decklist, fusion du pool, scoring, statistiques) est un ensemble de fonctions TypeScript pures dans `frontend/lib/engine/`, testées sans réseau.

## Prérequis

PHP 8.2+, Composer, Node 22+, MySQL (ou MariaDB).

## Démarrage local

```bash
# Base de données
mysql -u root -e "CREATE DATABASE mtg_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# API (port 8000)
cd api
composer install
cp .env .env.local   # ajustez DATABASE_URL si besoin
php bin/console lexik:jwt:generate-keypair --skip-if-exists
php bin/console doctrine:migrations:migrate -n
symfony server:start --port=8000

# Frontend (port 3000)
cd frontend
npm install
npm run dev
```

Le front proxifie `/api` vers `http://127.0.0.1:8000/api` en développement (voir `nitro.devProxy` dans `nuxt.config.ts`).

## Tests

```bash
cd frontend
npm run test                                     # tests unitaires du moteur
INTEGRATION=1 npm run test -- tests/integration.test.ts   # bout-en-bout (API locale + Scryfall réel)
```

## Données de démonstration

Le script `tools/seed.ts` crée un compte et y importe une collection et des decks de test (API locale requise).

```bash
cd frontend
npx tsx ../tools/seed.ts    # variables SEED_USERNAME / SEED_PASSWORD pour personnaliser
```

## Documentation

- Guide utilisateur, architecture, API et déploiement : [Wiki du projet](https://github.com/Fyrins/Commander-Builder/wiki).
- Procédure de mise en production : [`DEPLOY.md`](./DEPLOY.md).

## Contribuer

Bugs et suggestions via les [issues](https://github.com/Fyrins/Commander-Builder/issues) (modèles fournis). Le développement suit le flux `feat/*` vers `develop`, puis `develop` vers `main` pour les mises en production.

## Licence et données

Commander Builder is unofficial Fan Content permitted under the [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

Données de cartes et images fournies par [Scryfall](https://scryfall.com), statistiques de popularité par [EDHREC](https://edhrec.com).
