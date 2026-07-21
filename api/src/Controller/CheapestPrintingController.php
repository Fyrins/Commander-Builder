<?php

namespace App\Controller;

use App\Entity\OraclePrice;
use App\Repository\OraclePriceRepository;
use App\Service\ScryfallClient;
use Doctrine\DBAL\Exception\RetryableException;
use Doctrine\Persistence\ManagerRegistry;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Édition la moins chère (EUR) par oracle_id, mise en cache partagé. Une carte
 * jouée dans tous les decks (Sol Ring, Command Tower…) n'est cherchée qu'une
 * fois pour l'ensemble des utilisateurs.
 */
class CheapestPrintingController extends AbstractController
{
    private const MAX_ORACLE_IDS = 300;
    private const CACHE_TTL_DAYS = 7;

    public function __construct(
        private readonly ManagerRegistry $registry,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('/api/cards/cheapest', name: 'api_cards_cheapest', methods: ['POST'])]
    public function __invoke(Request $request, OraclePriceRepository $repository, ScryfallClient $scryfallClient): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload) || !isset($payload['oracleIds']) || !is_array($payload['oracleIds'])) {
            return new JsonResponse(['error' => 'Le corps de la requête doit contenir un tableau "oracleIds".'], 400);
        }

        $oracleIds = array_values(array_unique(array_filter(array_map(
            static fn ($id): string => is_string($id) ? $id : '',
            $payload['oracleIds'],
        ))));

        if (count($oracleIds) > self::MAX_ORACLE_IDS) {
            return new JsonResponse(['error' => sprintf('Maximum %d oracle_id par requête.', self::MAX_ORACLE_IDS)], 400);
        }

        $cached = $repository->findByOracleIds($oracleIds);
        $prices = [];
        $toFetch = [];

        foreach ($oracleIds as $oracleId) {
            $entry = $cached[$oracleId] ?? null;
            if ($entry !== null && !$this->isStale($entry)) {
                $prices[$oracleId] = $entry->toArray();
            } else {
                $toFetch[] = $oracleId;
            }
        }

        $fresh = [];
        foreach ($toFetch as $oracleId) {
            $cheapest = $scryfallClient->findCheapestPrinting($oracleId);
            $fresh[$oracleId] = $cheapest; // peut être null (aucune cote EUR)
            $prices[$oracleId] = [
                'oracleId' => $oracleId,
                'priceEur' => $cheapest['priceEur'] ?? null,
                'scryfallId' => $cheapest['scryfallId'] ?? null,
                'setCode' => $cheapest['setCode'] ?? null,
                'collectorNumber' => $cheapest['collectorNumber'] ?? null,
            ];
        }

        if (!empty($fresh)) {
            $this->persist($fresh);
        }

        return new JsonResponse([
            'prices' => $prices,
            'debug' => ['from_cache' => count($oracleIds) - count($toFetch), 'from_scryfall' => count($toFetch)],
        ]);
    }

    private function isStale(OraclePrice $entry): bool
    {
        return $entry->getResolvedAt() < new \DateTimeImmutable(sprintf('-%d days', self::CACHE_TTL_DAYS));
    }

    /**
     * Persiste les prix trouvés, en tolérant les deadlocks (même stratégie que
     * cards/resolve : manager frais par tentative, jamais de 500).
     *
     * @param array<string, array{scryfallId: string, setCode: string, collectorNumber: string, priceEur: string}|null> $fresh
     */
    private function persist(array $fresh): void
    {
        for ($attempt = 1; $attempt <= 3; ++$attempt) {
            $manager = $attempt === 1 ? $this->registry->getManager() : $this->registry->resetManager();
            /** @var OraclePriceRepository $repository */
            $repository = $manager->getRepository(OraclePrice::class);

            try {
                foreach ($fresh as $oracleId => $cheapest) {
                    $entry = $repository->find($oracleId) ?? (new OraclePrice())->setOracleId($oracleId);
                    $entry->setPriceEur($cheapest['priceEur'] ?? null);
                    $entry->setScryfallId($cheapest['scryfallId'] ?? null);
                    $entry->setSetCode($cheapest['setCode'] ?? null);
                    $entry->setCollectorNumber($cheapest['collectorNumber'] ?? null);
                    $entry->setResolvedAt(new \DateTimeImmutable());
                    $manager->persist($entry);
                }
                $manager->flush();

                return;
            } catch (RetryableException $exception) {
                if ($attempt === 3) {
                    $this->logger->warning('cards/cheapest : écriture du cache abandonnée après deadlocks.', [
                        'exception' => $exception->getMessage(),
                    ]);

                    return;
                }
                usleep(20000 * $attempt);
            }
        }
    }
}
