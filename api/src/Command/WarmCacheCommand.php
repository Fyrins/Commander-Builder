<?php

namespace App\Command;

use App\Entity\Card;
use App\Entity\OraclePrice;
use App\Repository\CardRepository;
use App\Repository\OraclePriceRepository;
use App\Service\CardMapper;
use App\Service\ScryfallClient;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Préchauffe les caches globaux (card + oracle_price) à partir des cartes
 * staples : analyse les decks moyens du top EDHREC, compte la fréquence
 * d'apparition des cartes, et pré-résout + pré-price celles présentes dans au
 * moins N decks. Idempotente : ne touche Scryfall que pour ce qui manque ou
 * est périmé. Destinée à un lancement manuel puis un cron nocturne en prod.
 */
#[AsCommand(name: 'app:warm-cache', description: 'Préchauffe le cache des cartes staples (EDHREC + Scryfall).')]
class WarmCacheCommand extends Command
{
    private const TOP_URL = 'https://json.edhrec.com/pages/commanders/year.json';
    private const AVERAGE_URL = 'https://json.edhrec.com/pages/average-decks/%s.json';
    private const BASIC_LANDS = ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'];

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly ScryfallClient $scryfallClient,
        private readonly CardMapper $cardMapper,
        private readonly EntityManagerInterface $em,
        private readonly CardRepository $cardRepository,
        private readonly OraclePriceRepository $oraclePriceRepository,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('commanders', 'c', InputOption::VALUE_REQUIRED, 'Nombre de commandants du top EDHREC à analyser', '60')
            ->addOption('min-decks', 'm', InputOption::VALUE_REQUIRED, 'Nombre minimum de decks où une carte doit apparaître pour être préchauffée', '5');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $maxCommanders = max(1, (int) $input->getOption('commanders'));
        $minDecks = max(1, (int) $input->getOption('min-decks'));

        // 1. Top commandants
        $slugs = $this->fetchTopSlugs($maxCommanders);
        if (empty($slugs)) {
            $io->error('Impossible de récupérer le top des commandants EDHREC.');

            return Command::FAILURE;
        }
        $io->text(sprintf('%d commandants à analyser.', count($slugs)));

        // 2. Fréquence des cartes dans les decks moyens
        $frequency = [];
        $io->progressStart(count($slugs));
        foreach ($slugs as $slug) {
            foreach ($this->fetchDeckCardNames($slug) as $name) {
                $frequency[$name] = ($frequency[$name] ?? 0) + 1;
            }
            usleep(100000);
            $io->progressAdvance();
        }
        $io->progressFinish();

        $staples = array_keys(array_filter($frequency, static fn (int $count) => $count >= $minDecks));
        $io->text(sprintf('%d cartes staples (présentes dans ≥ %d decks).', count($staples), $minDecks));

        // 3. Préchauffage du cache de cartes (résolution par nom, ce qui manque)
        $oracleIds = $this->warmCards($staples, $io);

        // 4. Préchauffage du cache des prix les moins chers (par oracle_id)
        $pricesWarmed = $this->warmOraclePrices($oracleIds, $io);

        $io->success(sprintf(
            'Préchauffage terminé : %d cartes staples, %d oracle_id, %d prix mis à jour.',
            count($staples),
            count($oracleIds),
            $pricesWarmed,
        ));

        return Command::SUCCESS;
    }

    /** @return array<int, string> slugs */
    private function fetchTopSlugs(int $max): array
    {
        try {
            $data = $this->httpClient->request('GET', self::TOP_URL, [
                'headers' => ['User-Agent' => 'MTGBuilder/0.1', 'Accept' => 'application/json'],
            ])->toArray(false);
        } catch (\Throwable) {
            return [];
        }

        $cardviews = $data['container']['json_dict']['cardlists'][0]['cardviews'] ?? [];
        $slugs = [];
        foreach ($cardviews as $cardview) {
            if (!empty($cardview['sanitized'])) {
                $slugs[] = (string) $cardview['sanitized'];
            }
            if (count($slugs) >= $max) {
                break;
            }
        }

        return $slugs;
    }

    /** @return array<int, string> noms de cartes (hors terrains de base) */
    private function fetchDeckCardNames(string $slug): array
    {
        try {
            $data = $this->httpClient->request('GET', sprintf(self::AVERAGE_URL, $slug), [
                'headers' => ['User-Agent' => 'MTGBuilder/0.1', 'Accept' => 'application/json'],
            ])->toArray(false);
        } catch (\Throwable) {
            return [];
        }

        $names = [];
        foreach ($data['deck'] ?? [] as $line) {
            if (!preg_match('/^\d+\s+(.+)$/', (string) $line, $matches)) {
                continue;
            }
            $name = trim($matches[1]);
            $lower = mb_strtolower($name);
            if (in_array($lower, self::BASIC_LANDS, true) || str_starts_with($lower, 'snow-covered ')) {
                continue;
            }
            $names[] = $name;
        }

        return array_values(array_unique($names));
    }

    /**
     * Résout et persiste les cartes manquantes/périmées, retourne les oracle_id.
     *
     * @param array<int, string> $names
     *
     * @return array<int, string> oracle_id uniques
     */
    private function warmCards(array $names, SymfonyStyle $io): array
    {
        $oracleIds = [];
        $toResolve = [];

        foreach ($names as $name) {
            $existing = $this->cardRepository->findOneByName($name);
            if ($existing !== null && !$this->cardMapper->isStale($existing)) {
                $oracleIds[$existing->getOracleId()] = true;
            } else {
                $toResolve[] = ['name' => $name];
            }
        }

        $io->text(sprintf('Cartes à résoudre : %d (le reste déjà en cache frais).', count($toResolve)));

        if (!empty($toResolve)) {
            $result = $this->scryfallClient->fetchCollection($toResolve);
            foreach ($result['cards'] as $raw) {
                $card = $this->cardRepository->find((string) $raw['id']) ?? new Card();
                $this->cardMapper->apply($card, $raw);
                $this->em->persist($card);
                $oracleIds[$card->getOracleId()] = true;
            }
            $this->em->flush();
        }

        return array_keys($oracleIds);
    }

    /**
     * Récupère et persiste l'édition la moins chère par oracle_id (ce qui manque
     * ou est périmé). Retourne le nombre de prix effectivement mis à jour.
     *
     * @param array<int, string> $oracleIds
     */
    private function warmOraclePrices(array $oracleIds, SymfonyStyle $io): int
    {
        $cached = $this->oraclePriceRepository->findByOracleIds($oracleIds);
        $toFetch = [];
        foreach ($oracleIds as $oracleId) {
            $entry = $cached[$oracleId] ?? null;
            if ($entry === null || $entry->getResolvedAt() < new \DateTimeImmutable(sprintf('-%d days', CardMapper::CACHE_TTL_DAYS))) {
                $toFetch[] = $oracleId;
            }
        }

        if (empty($toFetch)) {
            $io->text('Prix déjà à jour pour tous les oracle_id.');

            return 0;
        }

        $io->text(sprintf('Prix à récupérer : %d.', count($toFetch)));
        $io->progressStart(count($toFetch));

        $count = 0;
        foreach ($toFetch as $oracleId) {
            $cheapest = $this->scryfallClient->findCheapestPrinting($oracleId);
            $entry = $this->oraclePriceRepository->find($oracleId) ?? (new OraclePrice())->setOracleId($oracleId);
            $entry->setPriceEur($cheapest['priceEur'] ?? null);
            $entry->setScryfallId($cheapest['scryfallId'] ?? null);
            $entry->setSetCode($cheapest['setCode'] ?? null);
            $entry->setCollectorNumber($cheapest['collectorNumber'] ?? null);
            $entry->setResolvedAt(new \DateTimeImmutable());
            $this->em->persist($entry);
            ++$count;
            $io->progressAdvance();
        }
        $this->em->flush();
        $io->progressFinish();

        return $count;
    }
}
