<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class EdhrecController extends AbstractController
{
    private const TOP_COMMANDERS_LIMIT = 60;

    #[Route('/api/edhrec/top', name: 'api_edhrec_top', methods: ['GET'], priority: 10)]
    public function top(HttpClientInterface $httpClient, CacheInterface $cache): JsonResponse
    {
        try {
            $payload = $cache->get('edhrec_top_commanders', function (ItemInterface $item) use ($httpClient) {
                $item->expiresAfter(24 * 3600);

                $response = $httpClient->request('GET', 'https://json.edhrec.com/pages/commanders/year.json', [
                    'headers' => ['User-Agent' => 'MTGBuilder/0.1', 'Accept' => 'application/json'],
                ]);

                if (404 === $response->getStatusCode()) {
                    $item->expiresAfter(60);

                    return null;
                }

                $data = $response->toArray();

                $cardviews = [];
                foreach ($data['container']['json_dict']['cardlists'] ?? [] as $cardlist) {
                    foreach ($cardlist['cardviews'] ?? [] as $cardview) {
                        $cardviews[] = $cardview;
                    }
                }

                usort($cardviews, static fn (array $a, array $b) => ($a['rank'] ?? PHP_INT_MAX) <=> ($b['rank'] ?? PHP_INT_MAX));

                $commanders = array_map(static function (array $cardview) {
                    return [
                        'name' => $cardview['name'] ?? '',
                        'slug' => $cardview['sanitized'] ?? '',
                        'numDecks' => (int) ($cardview['num_decks'] ?? 0),
                    ];
                }, array_slice($cardviews, 0, self::TOP_COMMANDERS_LIMIT));

                return ['commanders' => $commanders];
            });
        } catch (ExceptionInterface) {
            return new JsonResponse(['error' => 'Top commandants EDHREC introuvable.'], 404);
        }

        if ($payload === null) {
            return new JsonResponse(['error' => 'Top commandants EDHREC introuvable.'], 404);
        }

        return new JsonResponse($payload);
    }

    #[Route('/api/edhrec/average/{slug}', name: 'api_edhrec_average', methods: ['GET'], priority: 10)]
    public function average(string $slug, HttpClientInterface $httpClient, CacheInterface $cache): JsonResponse
    {
        try {
            $payload = $cache->get('edhrec_average_deck_' . $slug, function (ItemInterface $item) use ($slug, $httpClient) {
                $item->expiresAfter(6 * 3600);

                $response = $httpClient->request('GET', sprintf('https://json.edhrec.com/pages/average-decks/%s.json', $slug), [
                    'headers' => ['User-Agent' => 'MTGBuilder/0.1', 'Accept' => 'application/json'],
                ]);

                if (404 === $response->getStatusCode()) {
                    $item->expiresAfter(60);

                    return null;
                }

                $data = $response->toArray();

                return ['commander' => $slug, 'decklist' => $data['deck'] ?? []];
            });
        } catch (ExceptionInterface) {
            return new JsonResponse(['error' => 'Deck moyen EDHREC introuvable.'], 404);
        }

        if ($payload === null) {
            return new JsonResponse(['error' => 'Deck moyen EDHREC introuvable.'], 404);
        }

        return new JsonResponse($payload);
    }

    #[Route('/api/edhrec/{slug}', name: 'api_edhrec', methods: ['GET'])]
    public function __invoke(string $slug, HttpClientInterface $httpClient, CacheInterface $cache): JsonResponse
    {
        try {
            $payload = $cache->get('edhrec_commander_' . $slug, function (ItemInterface $item) use ($slug, $httpClient) {
                $item->expiresAfter(6 * 3600);

                $response = $httpClient->request('GET', sprintf('https://json.edhrec.com/pages/commanders/%s.json', $slug), [
                    'headers' => ['User-Agent' => 'MTGBuilder/0.1', 'Accept' => 'application/json'],
                ]);

                if (404 === $response->getStatusCode()) {
                    $item->expiresAfter(60);

                    return null;
                }

                $data = $response->toArray();

                $cardlists = array_map(static function (array $cardlist) {
                    return [
                        'header' => $cardlist['header'] ?? '',
                        'cards' => array_map(static function (array $cardview) {
                            $numDecks = (int) ($cardview['num_decks'] ?? 0);
                            $potentialDecks = (int) ($cardview['potential_decks'] ?? 0);

                            return [
                                'name' => $cardview['name'] ?? '',
                                'num_decks' => $numDecks,
                                'potential_decks' => $potentialDecks,
                                'inclusion' => $potentialDecks > 0 ? round($numDecks / $potentialDecks, 3) : 0.0,
                            ];
                        }, $cardlist['cardviews'] ?? []),
                    ];
                }, $data['container']['json_dict']['cardlists'] ?? []);

                return ['commander' => $slug, 'cardlists' => $cardlists];
            });
        } catch (ExceptionInterface) {
            return new JsonResponse(['error' => 'Commandant EDHREC introuvable.'], 404);
        }

        if ($payload === null) {
            return new JsonResponse(['error' => 'Commandant EDHREC introuvable.'], 404);
        }

        return new JsonResponse($payload);
    }
}
