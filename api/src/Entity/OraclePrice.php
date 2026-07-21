<?php

namespace App\Entity;

use App\Repository\OraclePriceRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Cache de l'édition la moins chère (en EUR) par oracle_id, partagé entre tous
 * les utilisateurs. Une carte comme Sol Ring n'est cherchée qu'une fois pour
 * tout le monde. `priceEur` null = aucune cote EUR trouvée (mémorisé pour ne
 * pas re-chercher en boucle avant expiration).
 */
#[ORM\Entity(repositoryClass: OraclePriceRepository::class)]
#[ORM\Table(name: 'oracle_price')]
class OraclePrice
{
    #[ORM\Id]
    #[ORM\Column(length: 36)]
    private string $oracleId;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, nullable: true)]
    private ?string $priceEur = null;

    #[ORM\Column(length: 36, nullable: true)]
    private ?string $scryfallId = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $setCode = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $collectorNumber = null;

    #[ORM\Column]
    private \DateTimeImmutable $resolvedAt;

    public function getOracleId(): string
    {
        return $this->oracleId;
    }

    public function setOracleId(string $oracleId): self
    {
        $this->oracleId = $oracleId;

        return $this;
    }

    public function getPriceEur(): ?string
    {
        return $this->priceEur;
    }

    public function setPriceEur(?string $priceEur): self
    {
        $this->priceEur = $priceEur;

        return $this;
    }

    public function getScryfallId(): ?string
    {
        return $this->scryfallId;
    }

    public function setScryfallId(?string $scryfallId): self
    {
        $this->scryfallId = $scryfallId;

        return $this;
    }

    public function getSetCode(): ?string
    {
        return $this->setCode;
    }

    public function setSetCode(?string $setCode): self
    {
        $this->setCode = $setCode;

        return $this;
    }

    public function getCollectorNumber(): ?string
    {
        return $this->collectorNumber;
    }

    public function setCollectorNumber(?string $collectorNumber): self
    {
        $this->collectorNumber = $collectorNumber;

        return $this;
    }

    public function getResolvedAt(): \DateTimeImmutable
    {
        return $this->resolvedAt;
    }

    public function setResolvedAt(\DateTimeImmutable $resolvedAt): self
    {
        $this->resolvedAt = $resolvedAt;

        return $this;
    }

    /** @return array{oracleId: string, priceEur: ?string, scryfallId: ?string, setCode: ?string, collectorNumber: ?string} */
    public function toArray(): array
    {
        return [
            'oracleId' => $this->oracleId,
            'priceEur' => $this->priceEur,
            'scryfallId' => $this->scryfallId,
            'setCode' => $this->setCode,
            'collectorNumber' => $this->collectorNumber,
        ];
    }
}
