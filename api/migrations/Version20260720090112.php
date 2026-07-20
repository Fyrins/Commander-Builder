<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260720090112 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql(<<<'SQL'
            CREATE TABLE card (
              scryfall_id VARCHAR(36) NOT NULL,
              oracle_id VARCHAR(36) NOT NULL,
              name VARCHAR(255) NOT NULL,
              printed_name VARCHAR(255) DEFAULT NULL,
              type_line VARCHAR(255) NOT NULL,
              oracle_text LONGTEXT DEFAULT NULL,
              mana_cost VARCHAR(255) DEFAULT NULL,
              cmc DOUBLE PRECISION NOT NULL,
              color_identity JSON NOT NULL,
              set_code VARCHAR(20) NOT NULL,
              collector_number VARCHAR(20) NOT NULL,
              lang VARCHAR(8) NOT NULL,
              image_small VARCHAR(255) DEFAULT NULL,
              image_normal VARCHAR(255) DEFAULT NULL,
              is_basic_land TINYINT NOT NULL,
              is_commander_legal TINYINT NOT NULL,
              resolved_at DATETIME NOT NULL,
              INDEX idx_card_oracle_id (oracle_id),
              INDEX idx_card_set_collector (set_code, collector_number),
              PRIMARY KEY (scryfall_id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE collection_item (
              id INT AUTO_INCREMENT NOT NULL,
              scryfall_id VARCHAR(36) NOT NULL,
              quantity INT NOT NULL,
              foil TINYINT NOT NULL,
              language VARCHAR(8) NOT NULL,
              `condition` VARCHAR(255) DEFAULT NULL,
              user_id INT NOT NULL,
              INDEX idx_collection_item_user (user_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE deck (
              id INT AUTO_INCREMENT NOT NULL,
              name VARCHAR(255) NOT NULL,
              is_owned_deck TINYINT NOT NULL,
              include_in_pool TINYINT NOT NULL,
              created_at DATETIME NOT NULL,
              user_id INT NOT NULL,
              INDEX idx_deck_user (user_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE deck_item (
              id INT AUTO_INCREMENT NOT NULL,
              name_raw VARCHAR(255) NOT NULL,
              set_code VARCHAR(20) DEFAULT NULL,
              collector_number VARCHAR(20) DEFAULT NULL,
              quantity INT NOT NULL,
              foil TINYINT NOT NULL,
              scryfall_id VARCHAR(36) DEFAULT NULL,
              oracle_id VARCHAR(36) DEFAULT NULL,
              deck_id INT NOT NULL,
              INDEX idx_deck_item_deck (deck_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE `user` (
              id INT AUTO_INCREMENT NOT NULL,
              email VARCHAR(180) NOT NULL,
              roles JSON NOT NULL,
              password VARCHAR(255) NOT NULL,
              created_at DATETIME NOT NULL,
              UNIQUE INDEX uniq_user_email (email),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE
              collection_item
            ADD
              CONSTRAINT FK_556C09F0A76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id)
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE
              deck
            ADD
              CONSTRAINT FK_4FAC3637A76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id)
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE
              deck_item
            ADD
              CONSTRAINT FK_23FC6120111948DC FOREIGN KEY (deck_id) REFERENCES deck (id)
        SQL);
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE collection_item DROP FOREIGN KEY FK_556C09F0A76ED395');
        $this->addSql('ALTER TABLE deck DROP FOREIGN KEY FK_4FAC3637A76ED395');
        $this->addSql('ALTER TABLE deck_item DROP FOREIGN KEY FK_23FC6120111948DC');
        $this->addSql('DROP TABLE card');
        $this->addSql('DROP TABLE collection_item');
        $this->addSql('DROP TABLE deck');
        $this->addSql('DROP TABLE deck_item');
        $this->addSql('DROP TABLE `user`');
    }
}
