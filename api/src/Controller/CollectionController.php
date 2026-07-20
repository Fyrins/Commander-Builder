<?php

namespace App\Controller;

use App\Entity\CollectionItem;
use App\Entity\User;
use App\Repository\CollectionItemRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class CollectionController extends AbstractController
{
    #[Route('/api/collection', name: 'api_collection_get', methods: ['GET'])]
    public function get(#[CurrentUser] User $user, CollectionItemRepository $collectionItemRepository): JsonResponse
    {
        $items = $collectionItemRepository->findBy(['user' => $user]);

        return new JsonResponse(array_map(
            static fn (CollectionItem $item) => $item->toArray(),
            $items,
        ));
    }

    #[Route('/api/collection', name: 'api_collection_put', methods: ['PUT'])]
    public function put(Request $request, #[CurrentUser] User $user, EntityManagerInterface $entityManager, CollectionItemRepository $collectionItemRepository): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload) || !isset($payload['items']) || !is_array($payload['items'])) {
            return new JsonResponse(['error' => 'Le corps de la requête doit contenir un tableau "items".'], 400);
        }

        $entityManager->wrapInTransaction(function () use ($payload, $user, $entityManager, $collectionItemRepository) {
            $existing = $collectionItemRepository->findBy(['user' => $user]);
            foreach ($existing as $item) {
                $entityManager->remove($item);
            }
            $entityManager->flush();

            foreach ($payload['items'] as $itemData) {
                if (!is_array($itemData) || empty($itemData['scryfallId'])) {
                    continue;
                }

                $item = new CollectionItem();
                $item->setUser($user);
                $item->setScryfallId((string) $itemData['scryfallId']);
                $item->setQuantity(isset($itemData['quantity']) ? (int) $itemData['quantity'] : 1);
                $item->setFoil((bool) ($itemData['foil'] ?? false));
                $item->setLanguage((string) ($itemData['language'] ?? 'en'));
                $item->setCondition(isset($itemData['condition']) ? (string) $itemData['condition'] : null);

                $entityManager->persist($item);
            }

            $entityManager->flush();
        });

        $count = count($collectionItemRepository->findBy(['user' => $user]));

        return new JsonResponse(['count' => $count]);
    }
}
