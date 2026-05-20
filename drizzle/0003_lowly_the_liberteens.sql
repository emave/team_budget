ALTER TABLE `settings` ADD `cash_opening_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `card_opening_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `currency`;