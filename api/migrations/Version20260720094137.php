<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260720094137 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE card ADD price_eur NUMERIC(10, 2) DEFAULT NULL, ADD price_eur_foil NUMERIC(10, 2) DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_card_name ON card (name)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP INDEX idx_card_name ON card');
        $this->addSql('ALTER TABLE card DROP price_eur, DROP price_eur_foil');
    }
}
