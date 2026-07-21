<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Client HTTP dédié à l'API "collection" de Scryfall.
 * https://scryfall.com/docs/api/cards/collection
 */
class ScryfallClient
{
    private const BATCH_SIZE = 75;
    private const ENDPOINT = 'https://api.scryfall.com/cards/collection';
    private const SEARCH_ENDPOINT = 'https://api.scryfall.com/cards/search';

    public function __construct(private readonly HttpClientInterface $httpClient)
    {
    }

    /**
     * Impression papier la moins chère (en EUR) pour un oracle_id donné. Parcourt
     * toutes les éditions via l'endpoint search et retient le prix le plus bas.
     *
     * @return array{scryfallId: string, setCode: string, collectorNumber: string, priceEur: string}|null
     *   null si aucune édition n'a de cote EUR (ou carte inconnue)
     */
    public function findCheapestPrinting(string $oracleId): ?array
    {
        $cheapest = null;
        $url = self::SEARCH_ENDPOINT;
        // Tri croissant par prix EUR + filtre papier ; on suit la pagination.
        $query = ['q' => sprintf('oracleid:%s game:paper', $oracleId), 'unique' => 'prints', 'order' => 'eur', 'dir' => 'asc'];

        for ($page = 0; $page < 5; ++$page) {
            try {
                $response = $this->httpClient->request('GET', $url, [
                    'query' => $query,
                    'headers' => ['User-Agent' => 'MTGBuilder/0.1', 'Accept' => 'application/json'],
                ]);
                $data = $response->toArray(false);
            } catch (ExceptionInterface) {
                break;
            }

            // 404 = aucune carte pour cet oracle_id (ex. token) : rien à faire.
            if (($data['object'] ?? null) === 'error') {
                break;
            }

            foreach ($data['data'] ?? [] as $card) {
                $eur = $card['prices']['eur'] ?? null;
                if ($eur === null || $eur === '') {
                    continue;
                }
                if ($cheapest === null || (float) $eur < (float) $cheapest['priceEur']) {
                    $cheapest = [
                        'scryfallId' => (string) ($card['id'] ?? ''),
                        'setCode' => (string) ($card['set'] ?? ''),
                        'collectorNumber' => (string) ($card['collector_number'] ?? ''),
                        'priceEur' => (string) $eur,
                    ];
                }
            }

            usleep(100000);

            if (!($data['has_more'] ?? false) || empty($data['next_page'])) {
                break;
            }
            $url = (string) $data['next_page'];
            $query = []; // next_page contient déjà tous les paramètres
        }

        return $cheapest;
    }

    /**
     * @param array<int, array<string, string>> $identifiers Chaque élément est
     *   ['id' => scryfallId] ou ['set' => 'acr', 'collector_number' => '274']
     *
     * @return array{cards: array<int, array<string, mixed>>, not_found: array<int, array<string, mixed>>}
     */
    public function fetchCollection(array $identifiers): array
    {
        $cards = [];
        $notFound = [];

        foreach (array_chunk($identifiers, self::BATCH_SIZE) as $batch) {
            try {
                $response = $this->httpClient->request('POST', self::ENDPOINT, [
                    'json' => ['identifiers' => $batch],
                    'headers' => [
                        'User-Agent' => 'MTGBuilder/0.1',
                        'Accept' => 'application/json',
                    ],
                ]);

                $data = $response->toArray(false);
            } catch (ExceptionInterface) {
                // En cas d'échec réseau, on considère le batch entier comme non trouvé.
                foreach ($batch as $identifier) {
                    $notFound[] = $identifier;
                }
                usleep(100000);
                continue;
            }

            foreach ($data['data'] ?? [] as $card) {
                $cards[] = $card;
            }

            foreach ($data['not_found'] ?? [] as $identifier) {
                $notFound[] = $identifier;
            }

            usleep(100000);
        }

        return ['cards' => $cards, 'not_found' => $notFound];
    }
}
