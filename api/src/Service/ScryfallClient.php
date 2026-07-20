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

    public function __construct(private readonly HttpClientInterface $httpClient)
    {
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
