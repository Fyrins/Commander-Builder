<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260721083039 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Anonymisation : renomme user.email en user.username (varchar 30, pseudonyme uniquement).';
    }

    public function up(Schema $schema): void
    {
        // Comptes de test jetables (runs INTEGRATION=1 non nettoyés) dont l'identifiant
        // dépasse les 30 caractères du nouveau champ username ; 0 collection/deck associé.
        $this->addSql('DELETE FROM `user` WHERE CHAR_LENGTH(email) > 30');
        // Rename de colonne (pas de drop/recreate) : les comptes existants survivent.
        $this->addSql('ALTER TABLE `user` CHANGE email username VARCHAR(30) NOT NULL');
        $this->addSql('ALTER TABLE `user` RENAME INDEX uniq_user_email TO uniq_user_username');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` RENAME INDEX uniq_user_username TO uniq_user_email');
        $this->addSql('ALTER TABLE `user` CHANGE username email VARCHAR(180) NOT NULL');
    }
}
