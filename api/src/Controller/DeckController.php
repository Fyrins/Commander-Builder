<?php

namespace App\Controller;

use App\Entity\Deck;
use App\Entity\DeckItem;
use App\Entity\User;
use App\Repository\DeckRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class DeckController extends AbstractController
{
    #[Route('/api/decks', name: 'api_decks_get', methods: ['GET'])]
    public function list(#[CurrentUser] User $user, DeckRepository $deckRepository): JsonResponse
    {
        $decks = $deckRepository->findBy(['user' => $user]);

        return new JsonResponse(array_map(static fn (Deck $deck) => $deck->toArray(), $decks));
    }

    #[Route('/api/decks', name: 'api_decks_post', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload) || empty($payload['name'])) {
            return new JsonResponse(['error' => 'Le nom du deck est requis.'], 400);
        }

        $deck = new Deck();
        $deck->setUser($user);
        $deck->setName((string) $payload['name']);
        $deck->setIsOwnedDeck((bool) ($payload['isOwnedDeck'] ?? false));
        $deck->setIncludeInPool(array_key_exists('includeInPool', $payload) ? (bool) $payload['includeInPool'] : true);

        foreach ((array) ($payload['items'] ?? []) as $itemData) {
            if (!is_array($itemData) || empty($itemData['nameRaw'])) {
                continue;
            }

            $item = new DeckItem();
            $item->setNameRaw((string) $itemData['nameRaw']);
            $item->setSetCode(isset($itemData['setCode']) ? (string) $itemData['setCode'] : null);
            $item->setCollectorNumber(isset($itemData['collectorNumber']) ? (string) $itemData['collectorNumber'] : null);
            $item->setQuantity(isset($itemData['quantity']) ? (int) $itemData['quantity'] : 1);
            $item->setFoil((bool) ($itemData['foil'] ?? false));

            $deck->addItem($item);
        }

        $entityManager->persist($deck);
        $entityManager->flush();

        return new JsonResponse($deck->toArray(), 201);
    }

    #[Route('/api/decks/{id}', name: 'api_decks_patch', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request, #[CurrentUser] User $user, DeckRepository $deckRepository, EntityManagerInterface $entityManager): JsonResponse
    {
        $deck = $deckRepository->findOneBy(['id' => $id, 'user' => $user]);

        if (!$deck) {
            return new JsonResponse(['error' => 'Deck introuvable.'], 404);
        }

        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return new JsonResponse(['error' => 'Corps de requête JSON invalide.'], 400);
        }

        if (array_key_exists('includeInPool', $payload)) {
            $deck->setIncludeInPool((bool) $payload['includeInPool']);
        }

        if (array_key_exists('name', $payload) && !empty($payload['name'])) {
            $deck->setName((string) $payload['name']);
        }

        $entityManager->flush();

        return new JsonResponse($deck->toArray());
    }

    #[Route('/api/decks/{id}', name: 'api_decks_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id, #[CurrentUser] User $user, DeckRepository $deckRepository, EntityManagerInterface $entityManager): JsonResponse
    {
        $deck = $deckRepository->findOneBy(['id' => $id, 'user' => $user]);

        if (!$deck) {
            return new JsonResponse(['error' => 'Deck introuvable.'], 404);
        }

        $entityManager->remove($deck);
        $entityManager->flush();

        return new JsonResponse(null, 204);
    }
}
