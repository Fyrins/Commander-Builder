<?php

namespace App\Entity;

use App\Repository\CollectionItemRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CollectionItemRepository::class)]
#[ORM\Table(name: 'collection_item')]
#[ORM\Index(name: 'idx_collection_item_user', columns: ['user_id'])]
class CollectionItem
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $user = null;

    #[ORM\Column(length: 36)]
    private string $scryfallId;

    #[ORM\Column]
    private int $quantity = 1;

    #[ORM\Column]
    private bool $foil = false;

    #[ORM\Column(length: 8)]
    private string $language = 'en';

    #[ORM\Column(name: '`condition`', nullable: true)]
    private ?string $condition = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;

        return $this;
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

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function setLanguage(string $language): static
    {
        $this->language = $language;

        return $this;
    }

    public function getCondition(): ?string
    {
        return $this->condition;
    }

    public function setCondition(?string $condition): static
    {
        $this->condition = $condition;

        return $this;
    }

    public function toArray(): array
    {
        return [
            'scryfallId' => $this->scryfallId,
            'quantity' => $this->quantity,
            'foil' => $this->foil,
            'language' => $this->language,
            'condition' => $this->condition,
        ];
    }
}
