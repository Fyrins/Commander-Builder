# MTG Commander Builder

Importez votre collection Magic: The Gathering (export ManaBox), découvrez quels commandants vous pouvez jouer, et mesurez à quel point votre collection couvre n'importe quelle decklist Commander — avec les cartes manquantes triées et le « deck moyen » EDHREC comme liste d'achat priorisée.

## Fonctionnalités

- **Inventaire** : collection CSV ManaBox + decks montés fusionnés en un pool unique (case « inclure mes decks »), répartition par identité de couleur.
- **Commandants** : détection automatique des commandants légaux présents dans votre pool.
- **Comparateur** : choisissez un de vos decks ou collez une decklist → % de complétion + cartes manquantes. Option « inclure les autres éditions » (matching par `oracle_id`, insensible à la langue).
- **EDHREC** : deck moyen d'un commandant trié par popularité, croisé avec votre pool.

## Stack

| | |
|---|---|
| Frontend | Nuxt 4 (SPA), TypeScript, Tailwind CSS 4, PWA |
| API | Symfony 7.4, API Platform, Doctrine (MySQL), JWT (cookie HttpOnly) |
| Données cartes | API Scryfall (cache serveur partagé), aucune donnée embarquée |

## Démarrage local

```bash
# API (port 8000)
cd api
composer install
php bin/console lexik:jwt:generate-keypair --skip-if-exists
php bin/console doctrine:migrations:migrate -n
symfony server:start --port=8000

# Frontend (port 3000)
cd frontend
npm install
npm run dev
```

Tests du moteur : `cd frontend && npm run test`.

## Licence & données

Données de cartes fournies par [Scryfall](https://scryfall.com) — ce projet n'est pas affilié à Wizards of the Coast. Statistiques de popularité via [EDHREC](https://edhrec.com).
