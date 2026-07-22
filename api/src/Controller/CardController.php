<?php

namespace App\Controller;

use App\Entity\Card;
use App\Repository\CardRepository;
use App\Service\CardMapper;
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
    private const PERSIST_MAX_ATTEMPTS = 3;

    public function __construct(
        private readonly ManagerRegistry $registry,
        private readonly CardMapper $cardMapper,
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
                    $this->cardMapper->apply($card, $scryfallCard);
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

            if ($card && !$this->cardMapper->isStale($card)) {
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
                $card = $this->cardMapper->fromScryfall($scryfallCard);
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
}
