<?php

namespace App\Repository;

use App\Entity\OraclePrice;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<OraclePrice>
 */
class OraclePriceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OraclePrice::class);
    }

    /**
     * @param array<int, string> $oracleIds
     *
     * @return array<string, OraclePrice> indexé par oracleId
     */
    public function findByOracleIds(array $oracleIds): array
    {
        if (empty($oracleIds)) {
            return [];
        }

        $result = [];
        foreach ($this->findBy(['oracleId' => $oracleIds]) as $entry) {
            $result[$entry->getOracleId()] = $entry;
        }

        return $result;
    }
}
