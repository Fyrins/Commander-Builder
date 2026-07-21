<?php

namespace App\Controller;

use App\Entity\Card;
use App\Repository\CardRepository;
use App\Service\ScryfallClient;
use Doctrine\DBAL\Exception\RetryableException;
use Doctrine\Persistence\ManagerRegistry;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class CardController extends AbstractController
{
    private const MAX_IDENTIFIERS = 300;
    private const CACHE_TTL_DAYS = 7;
    private const PERSIST_MAX_ATTEMPTS = 3;

    public function __construct(
        private readonly ManagerRegistry $registry,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Écrit le cache de cartes en tolérant les deadlocks MySQL : deux requêtes
     * concurrentes peuvent verrouiller les mêmes lignes de `card`. Un flush qui
     * échoue ferme l'EntityManager ; chaque nouvelle tentative repart donc d'un
     * manager frais (resetManager) en reconstruisant les entités depuis le
     * payload Scryfall brut. En dernier recours on abandonne l'écriture SANS
     * casser la requête (le cache se réécrira au prochain passage) — un deadlock
     * ne doit jamais renvoyer un 500 à l'utilisateur.
     *
     * @param array<int, array<string, mixed>> $scryfallCards
     */
    private function persistScryfallCards(array $scryfallCards): void
    {
        if (empty($scryfallCards)) {
            return;
        }

        for ($attempt = 1; $attempt <= self::PERSIST_MAX_ATTEMPTS; ++$attempt) {
            $manager = $attempt === 1 ? $this->registry->getManager() : $this->registry->resetManager();
            /** @var CardRepository $repository */
            $repository = $manager->getRepository(Card::class);

            try {
                foreach ($scryfallCards as $scryfallCard) {
                    $card = $repository->find((string) $scryfallCard['id']) ?? new Card();
                    $this->applyScryfallData($card, $scryfallCard);
                    $manager->persist($card);
                }
                $manager->flush();

                return;
            } catch (RetryableException $exception) {
                if ($attempt === self::PERSIST_MAX_ATTEMPTS) {
                    $this->logger->warning('cards/resolve : écriture du cache abandonnée après deadlocks répétés.', [
                        'exception' => $exception->getMessage(),
                    ]);

                    return;
                }
                // Back-off court et croissant (20ms, 40ms) avant nouvelle tentative.
                usleep(20000 * $attempt);
            }
        }
    }

    #[Route('/api/cards/resolve', name: 'api_cards_resolve', methods: ['POST'])]
    public function resolve(Request $request, CardRepository $cardRepository, ScryfallClient $scryfallClient): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload) || !isset($payload['identifiers']) || !is_array($payload['identifiers'])) {
            return new JsonResponse(['error' => 'Le corps de la requête doit contenir un tableau "identifiers".'], 400);
        }

        $identifiers = $payload['identifiers'];

        if (count($identifiers) > self::MAX_IDENTIFIERS) {
            return new JsonResponse(['error' => sprintf('Maximum %d identifiants par requête.', self::MAX_IDENTIFIERS)], 400);
        }

        $resolvedCards = [];
        $missing = [];
        $fromCache = 0;

        foreach ($identifiers as $identifier) {
            if (!is_array($identifier)) {
                continue;
            }

            $card = null;

            if (!empty($identifier['scryfallId'])) {
                $card = $cardRepository->find((string) $identifier['scryfallId']);
            } elseif (!empty($identifier['set']) && isset($identifier['collectorNumber'])) {
                $card = $cardRepository->findOneBySetAndCollectorNumber((string) $identifier['set'], (string) $identifier['collectorNumber']);
            } elseif (!empty($identifier['name'])) {
                $card = $cardRepository->findOneByName((string) $identifier['name']);
            }

            if ($card && !$this->isStale($card)) {
                $resolvedCards[$card->getScryfallId()] = $card;
                ++$fromCache;
            } else {
                $missing[] = $identifier;
            }
        }

        $fromScryfall = 0;
        $notFound = [];

        if (!empty($missing)) {
            $scryfallIdentifiers = array_map(static function (array $identifier) {
                if (!empty($identifier['scryfallId'])) {
                    return ['id' => $identifier['scryfallId']];
                }

                if (!empty($identifier['name'])) {
                    return ['name' => (string) $identifier['name']];
                }

                return [
                    'set' => $identifier['set'],
                    'collector_number' => (string) $identifier['collectorNumber'],
                ];
            }, $missing);

            $result = $scryfallClient->fetchCollection($scryfallIdentifiers);

            // Entités bâties en mémoire pour la réponse : indépendantes de la
            // persistance, pour que la réponse reste correcte même si l'écriture
            // du cache est abandonnée (deadlock).
            foreach ($result['cards'] as $scryfallCard) {
                $card = new Card();
                $this->applyScryfallData($card, $scryfallCard);
                $resolvedCards[$card->getScryfallId()] = $card;
                ++$fromScryfall;
            }

            $notFound = $result['not_found'];
            $this->persistScryfallCards($result['cards']);
        }

        return new JsonResponse([
            'cards' => array_map(static fn (Card $card) => $card->toArray(), array_values($resolvedCards)),
            'not_found' => $notFound,
            'debug' => [
                'from_cache' => $fromCache,
                'from_scryfall' => $fromScryfall,
            ],
        ]);
    }

    /**
     * Une carte en cache dont la résolution date de plus de CACHE_TTL_DAYS jours
     * est considérée comme périmée (notamment pour les prix, qui bougent).
     * Une carte sans aucun prix EUR connu est aussi traitée comme périmée : soit
     * elle a été mise en cache avant l'introduction des prix (à rattraper une
     * fois), soit Scryfall n'avait pas encore de cote Cardmarket au moment de la
     * résolution (à retenter, sans coût significatif vu le rythme des requêtes).
     * Même mécanique d'auto-guérison pour producedMana : un terrain (typeLine
     * contient "Land") mis en cache avant l'introduction de ce champ (donc null)
     * est aussi traité comme périmé, pour être re-résolu une fois auprès de
     * Scryfall.
     */
    private function isStale(Card $card): bool
    {
        if ($card->getPriceEur() === null && $card->getPriceEurFoil() === null) {
            return true;
        }

        // « Add  » n'apparaît dans un texte oracle que pour la production de mana
        if ($card->getProducedMana() === null
            && (str_contains($card->getTypeLine(), 'Land') || str_contains((string) $card->getOracleText(), 'Add '))
        ) {
            return true;
        }

        return $card->getResolvedAt() < new \DateTimeImmutable(sprintf('-%d days', self::CACHE_TTL_DAYS));
    }

    /**
     * Applique les données d'une carte Scryfall brute sur une entité Card
     * (existante ou neuve). Fonction pure : ne touche ni l'EntityManager ni la
     * base — la persistance et la lecture du cache sont gérées par l'appelant.
     *
     * @param array<string, mixed> $scryfallCard
     */
    private function applyScryfallData(Card $card, array $scryfallCard): void
    {
        $scryfallId = (string) $scryfallCard['id'];
        $card->setScryfallId($scryfallId);

        $faces = $scryfallCard['card_faces'] ?? null;
        $firstFace = is_array($faces) && isset($faces[0]) ? $faces[0] : null;

        // Repli sur le scryfallId si la carte n'expose pas d'oracle_id (rare)
        $oracleId = $scryfallCard['oracle_id'] ?? ($firstFace['oracle_id'] ?? $scryfallId);
        $card->setOracleId((string) $oracleId);

        $card->setName((string) ($scryfallCard['name'] ?? ''));
        $card->setPrintedName(isset($scryfallCard['printed_name']) ? (string) $scryfallCard['printed_name'] : null);
        $card->setTypeLine((string) ($scryfallCard['type_line'] ?? ''));

        $oracleText = $scryfallCard['oracle_text'] ?? null;
        if ($oracleText === null && is_array($faces)) {
            $oracleText = implode("\n//\n", array_filter(array_map(
                static fn (array $face) => $face['oracle_text'] ?? null,
                $faces,
            )));
        }
        $card->setOracleText($oracleText);

        $manaCost = $scryfallCard['mana_cost'] ?? ($firstFace['mana_cost'] ?? null);
        $card->setManaCost($manaCost !== null && $manaCost !== '' ? $manaCost : null);

        $card->setCmc((float) ($scryfallCard['cmc'] ?? 0));
        $card->setColorIdentity((array) ($scryfallCard['color_identity'] ?? []));

        $producedMana = $scryfallCard['produced_mana'] ?? null;
        $card->setProducedMana(is_array($producedMana) ? $producedMana : null);

        $card->setSetCode((string) ($scryfallCard['set'] ?? ''));
        $card->setCollectorNumber((string) ($scryfallCard['collector_number'] ?? ''));
        $card->setLang((string) ($scryfallCard['lang'] ?? 'en'));

        $imageUris = $scryfallCard['image_uris'] ?? ($firstFace['image_uris'] ?? null);
        $card->setImageSmall($imageUris['small'] ?? null);
        $card->setImageNormal($imageUris['normal'] ?? null);

        $prices = $scryfallCard['prices'] ?? [];
        $card->setPriceEur(isset($prices['eur']) && $prices['eur'] !== null ? (string) $prices['eur'] : null);
        $card->setPriceEurFoil(isset($prices['eur_foil']) && $prices['eur_foil'] !== null ? (string) $prices['eur_foil'] : null);

        $typeLine = $card->getTypeLine();
        $card->setIsBasicLand(str_contains($typeLine, 'Basic Land'));
        $card->setIsCommanderLegal(
            str_contains($typeLine, 'Legendary Creature')
            || str_contains((string) $oracleText, 'can be your commander')
        );

        $card->setResolvedAt(new \DateTimeImmutable());
    }
}
