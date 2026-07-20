<?php

namespace App\Repository;

use App\Entity\Card;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Card>
 */
class CardRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Card::class);
    }

    public function findOneBySetAndCollectorNumber(string $setCode, string $collectorNumber): ?Card
    {
        return $this->createQueryBuilder('c')
            ->andWhere('LOWER(c.setCode) = LOWER(:setCode)')
            ->andWhere('c.collectorNumber = :collectorNumber')
            ->setParameter('setCode', $setCode)
            ->setParameter('collectorNumber', $collectorNumber)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Résout une carte par son nom EN exact, y compris pour les cartes recto-verso
     * dont le nom complet est "Front // Back" alors que l'appelant ne donne que "Front"
     * (ex : identifiants EDHREC). Insensible à la casse.
     */
    public function findOneByName(string $name): ?Card
    {
        return $this->createQueryBuilder('c')
            ->andWhere('LOWER(c.name) = LOWER(:name) OR LOWER(c.name) LIKE LOWER(:namePrefix)')
            ->setParameter('name', $name)
            ->setParameter('namePrefix', $name . ' //%')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
