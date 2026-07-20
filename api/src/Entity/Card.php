<?php

namespace App\Entity;

use App\Repository\CardRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Cache local des cartes Scryfall, partagé entre tous les utilisateurs.
 */
#[ORM\Entity(repositoryClass: CardRepository::class)]
#[ORM\Table(name: 'card')]
#[ORM\Index(name: 'idx_card_oracle_id', columns: ['oracle_id'])]
#[ORM\Index(name: 'idx_card_set_collector', columns: ['set_code', 'collector_number'])]
#[ORM\Index(name: 'idx_card_name', columns: ['name'])]
class Card
{
    #[ORM\Id]
    #[ORM\Column(length: 36)]
    private string $scryfallId;

    #[ORM\Column(length: 36)]
    private string $oracleId;

    #[ORM\Column]
    private string $name;

    #[ORM\Column(nullable: true)]
    private ?string $printedName = null;

    #[ORM\Column]
    private string $typeLine;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $oracleText = null;

    #[ORM\Column(nullable: true)]
    private ?string $manaCost = null;

    #[ORM\Column]
    private float $cmc;

    #[ORM\Column]
    private array $colorIdentity = [];

    #[ORM\Column(length: 20)]
    private string $setCode;

    #[ORM\Column(length: 20)]
    private string $collectorNumber;

    #[ORM\Column(length: 8)]
    private string $lang;

    #[ORM\Column(nullable: true)]
    private ?string $imageSmall = null;

    #[ORM\Column(nullable: true)]
    private ?string $imageNormal = null;

    #[ORM\Column]
    private bool $isBasicLand = false;

    #[ORM\Column]
    private bool $isCommanderLegal = false;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, nullable: true)]
    private ?string $priceEur = null;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, nullable: true)]
    private ?string $priceEurFoil = null;

    #[ORM\Column]
    private \DateTimeImmutable $resolvedAt;

    public function __construct()
    {
        $this->resolvedAt = new \DateTimeImmutable();
    }

    public function getScryfallId(): string
    {
        return $this->scryfallId;
    }

    public function setScryfallId(string $scryfallId): static
    {
        $this->scryfallId = $scryfallId;

        return $this;
    }

    public function getOracleId(): string
    {
        return $this->oracleId;
    }

    public function setOracleId(string $oracleId): static
    {
        $this->oracleId = $oracleId;

        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getPrintedName(): ?string
    {
        return $this->printedName;
    }

    public function setPrintedName(?string $printedName): static
    {
        $this->printedName = $printedName;

        return $this;
    }

    public function getTypeLine(): string
    {
        return $this->typeLine;
    }

    public function setTypeLine(string $typeLine): static
    {
        $this->typeLine = $typeLine;

        return $this;
    }

    public function getOracleText(): ?string
    {
        return $this->oracleText;
    }

    public function setOracleText(?string $oracleText): static
    {
        $this->oracleText = $oracleText;

        return $this;
    }

    public function getManaCost(): ?string
    {
        return $this->manaCost;
    }

    public function setManaCost(?string $manaCost): static
    {
        $this->manaCost = $manaCost;

        return $this;
    }

    public function getCmc(): float
    {
        return $this->cmc;
    }

    public function setCmc(float $cmc): static
    {
        $this->cmc = $cmc;

        return $this;
    }

    public function getColorIdentity(): array
    {
        return $this->colorIdentity;
    }

    public function setColorIdentity(array $colorIdentity): static
    {
        $this->colorIdentity = $colorIdentity;

        return $this;
    }

    public function getSetCode(): string
    {
        return $this->setCode;
    }

    public function setSetCode(string $setCode): static
    {
        $this->setCode = $setCode;

        return $this;
    }

    public function getCollectorNumber(): string
    {
        return $this->collectorNumber;
    }

    public function setCollectorNumber(string $collectorNumber): static
    {
        $this->collectorNumber = $collectorNumber;

        return $this;
    }

    public function getLang(): string
    {
        return $this->lang;
    }

    public function setLang(string $lang): static
    {
        $this->lang = $lang;

        return $this;
    }

    public function getImageSmall(): ?string
    {
        return $this->imageSmall;
    }

    public function setImageSmall(?string $imageSmall): static
    {
        $this->imageSmall = $imageSmall;

        return $this;
    }

    public function getImageNormal(): ?string
    {
        return $this->imageNormal;
    }

    public function setImageNormal(?string $imageNormal): static
    {
        $this->imageNormal = $imageNormal;

        return $this;
    }

    public function isBasicLand(): bool
    {
        return $this->isBasicLand;
    }

    public function setIsBasicLand(bool $isBasicLand): static
    {
        $this->isBasicLand = $isBasicLand;

        return $this;
    }

    public function isCommanderLegal(): bool
    {
        return $this->isCommanderLegal;
    }

    public function setIsCommanderLegal(bool $isCommanderLegal): static
    {
        $this->isCommanderLegal = $isCommanderLegal;

        return $this;
    }

    public function getPriceEur(): ?string
    {
        return $this->priceEur;
    }

    public function setPriceEur(?string $priceEur): static
    {
        $this->priceEur = $priceEur;

        return $this;
    }

    public function getPriceEurFoil(): ?string
    {
        return $this->priceEurFoil;
    }

    public function setPriceEurFoil(?string $priceEurFoil): static
    {
        $this->priceEurFoil = $priceEurFoil;

        return $this;
    }

    public function getResolvedAt(): \DateTimeImmutable
    {
        return $this->resolvedAt;
    }

    public function setResolvedAt(\DateTimeImmutable $resolvedAt): static
    {
        $this->resolvedAt = $resolvedAt;

        return $this;
    }

    public function toArray(): array
    {
        return [
            'scryfallId' => $this->scryfallId,
            'oracleId' => $this->oracleId,
            'name' => $this->name,
            'printedName' => $this->printedName,
            'typeLine' => $this->typeLine,
            'oracleText' => $this->oracleText,
            'manaCost' => $this->manaCost,
            'cmc' => $this->cmc,
            'colorIdentity' => $this->colorIdentity,
            'setCode' => $this->setCode,
            'collectorNumber' => $this->collectorNumber,
            'lang' => $this->lang,
            'imageSmall' => $this->imageSmall,
            'imageNormal' => $this->imageNormal,
            'isBasicLand' => $this->isBasicLand,
            'isCommanderLegal' => $this->isCommanderLegal,
            'priceEur' => $this->priceEur,
            'priceEurFoil' => $this->priceEurFoil,
            'resolvedAt' => $this->resolvedAt->format(\DateTimeInterface::ATOM),
        ];
    }
}
