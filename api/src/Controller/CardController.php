<?php

namespace App\Controller;

use App\Entity\Card;
use App\Repository\CardRepository;
use App\Service\ScryfallClient;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class CardController extends AbstractController
{
    private const MAX_IDENTIFIERS = 300;
    private const CACHE_TTL_DAYS = 7;

    #[Route('/api/cards/resolve', name: 'api_cards_resolve', methods: ['POST'])]
    public function resolve(Request $request, CardRepository $cardRepository, ScryfallClient $scryfallClient, EntityManagerInterface $entityManager): JsonResponse
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

            foreach ($result['cards'] as $scryfallCard) {
                $card = $this->mapScryfallCardToEntity($scryfallCard, $cardRepository, $entityManager);
                $resolvedCards[$card->getScryfallId()] = $card;
                ++$fromScryfall;
            }

            $notFound = $result['not_found'];
            $entityManager->flush();
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
     * @param array<string, mixed> $scryfallCard
     */
    private function mapScryfallCardToEntity(array $scryfallCard, CardRepository $cardRepository, EntityManagerInterface $entityManager): Card
    {
        $scryfallId = (string) $scryfallCard['id'];

        $card = $cardRepository->find($scryfallId) ?? new Card();
        $card->setScryfallId($scryfallId);

        $faces = $scryfallCard['card_faces'] ?? null;
        $firstFace = is_array($faces) && isset($faces[0]) ? $faces[0] : null;

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

        $entityManager->persist($card);

        return $card;
    }
}
