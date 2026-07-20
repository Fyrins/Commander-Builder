<?php

namespace App\Entity;

use App\Repository\DeckItemRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: DeckItemRepository::class)]
#[ORM\Table(name: 'deck_item')]
#[ORM\Index(name: 'idx_deck_item_deck', columns: ['deck_id'])]
class DeckItem
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Deck::class, inversedBy: 'items')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Deck $deck = null;

    #[ORM\Column]
    private string $nameRaw;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $setCode = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $collectorNumber = null;

    #[ORM\Column]
    private int $quantity = 1;

    #[ORM\Column]
    private bool $foil = false;

    #[ORM\Column(length: 36, nullable: true)]
    private ?string $scryfallId = null;

    #[ORM\Column(length: 36, nullable: true)]
    private ?string $oracleId = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDeck(): ?Deck
    {
        return $this->deck;
    }

    public function setDeck(?Deck $deck): static
    {
        $this->deck = $deck;

        return $this;
    }

    public function getNameRaw(): string
    {
        return $this->nameRaw;
    }

    public function setNameRaw(string $nameRaw): static
    {
        $this->nameRaw = $nameRaw;

        return $this;
    }

    public function getSetCode(): ?string
    {
        return $this->setCode;
    }

    public function setSetCode(?string $setCode): static
    {
        $this->setCode = $setCode;

        return $this;
    }

    public function getCollectorNumber(): ?string
    {
        return $this->collectorNumber;
    }

    public function setCollectorNumber(?string $collectorNumber): static
    {
        $this->collectorNumber = $collectorNumber;

        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): static
    {
        $this->quantity = $quantity;

        return $this;
    }

    public function isFoil(): bool
    {
        return $this->foil;
    }

    public function setFoil(bool $foil): static
    {
        $this->foil = $foil;

        return $this;
    }

    public function getScryfallId(): ?string
    {
        return $this->scryfallId;
    }

    public function setScryfallId(?string $scryfallId): static
    {
        $this->scryfallId = $scryfallId;

        return $this;
    }

    public function getOracleId(): ?string
    {
        return $this->oracleId;
    }

    public function setOracleId(?string $oracleId): static
    {
        $this->oracleId = $oracleId;

        return $this;
    }

    public function toArray(): array
    {
        return [
            'nameRaw' => $this->nameRaw,
            'setCode' => $this->setCode,
            'collectorNumber' => $this->collectorNumber,
            'quantity' => $this->quantity,
            'foil' => $this->foil,
        ];
    }
}
