<?php

namespace App\Entity;

use App\Repository\DeckRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: DeckRepository::class)]
#[ORM\Table(name: 'deck')]
#[ORM\Index(name: 'idx_deck_user', columns: ['user_id'])]
class Deck
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $user = null;

    #[ORM\Column]
    private string $name;

    #[ORM\Column]
    private bool $isOwnedDeck = false;

    #[ORM\Column]
    private bool $includeInPool = true;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\OneToMany(targetEntity: DeckItem::class, mappedBy: 'deck', orphanRemoval: true, cascade: ['persist', 'remove'])]
    private Collection $items;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->items = new ArrayCollection();
    }

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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function isOwnedDeck(): bool
    {
        return $this->isOwnedDeck;
    }

    public function setIsOwnedDeck(bool $isOwnedDeck): static
    {
        $this->isOwnedDeck = $isOwnedDeck;

        return $this;
    }

    public function isIncludeInPool(): bool
    {
        return $this->includeInPool;
    }

    public function setIncludeInPool(bool $includeInPool): static
    {
        $this->includeInPool = $includeInPool;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /**
     * @return Collection<int, DeckItem>
     */
    public function getItems(): Collection
    {
        return $this->items;
    }

    public function addItem(DeckItem $item): static
    {
        if (!$this->items->contains($item)) {
            $this->items->add($item);
            $item->setDeck($this);
        }

        return $this;
    }

    public function removeItem(DeckItem $item): static
    {
        $this->items->removeElement($item);

        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'isOwnedDeck' => $this->isOwnedDeck,
            'includeInPool' => $this->includeInPool,
            'items' => array_map(static fn (DeckItem $item) => $item->toArray(), $this->items->toArray()),
        ];
    }
}
