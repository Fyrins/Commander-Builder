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
}
