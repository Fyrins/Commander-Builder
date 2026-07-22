<?php

namespace App\Service;

use App\Entity\Card;

/**
 * Traduction d'une carte Scryfall brute en entité Card, et règle de fraîcheur
 * du cache. Partagé entre l'endpoint de résolution (CardController) et la
 * commande de préchauffage (app:warm-cache) pour un mapping unique.
 */
class CardMapper
{
    public const CACHE_TTL_DAYS = 7;

    /** @param array<string, mixed> $scryfallCard */
    public function fromScryfall(array $scryfallCard): Card
    {
        $card = new Card();
        $this->apply($card, $scryfallCard);

        return $card;
    }

    /**
     * Applique les données Scryfall sur une entité (existante ou neuve).
     * Fonction pure : ne touche ni l'EntityManager ni la base.
     *
     * @param array<string, mixed> $scryfallCard
     */
    public function apply(Card $card, array $scryfallCard): void
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

    /**
     * Une carte en cache dont la résolution date de plus de CACHE_TTL_DAYS jours
     * est périmée (les prix bougent). Une carte sans aucun prix EUR est aussi
     * traitée comme périmée (mise en cache avant l'introduction des prix, ou
     * Scryfall sans cote Cardmarket au moment de la résolution : à retenter).
     * Idem pour producedMana : une carte productrice de mana (terrain, ou texte
     * « Add … ») avec producedMana null est re-résolue une fois.
     */
    public function isStale(Card $card): bool
    {
        if ($card->getPriceEur() === null && $card->getPriceEurFoil() === null) {
            return true;
        }

        if ($card->getProducedMana() === null
            && (str_contains($card->getTypeLine(), 'Land') || str_contains((string) $card->getOracleText(), 'Add '))
        ) {
            return true;
        }

        return $card->getResolvedAt() < new \DateTimeImmutable(sprintf('-%d days', self::CACHE_TTL_DAYS));
    }
}
