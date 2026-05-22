CREATE TABLE `credit_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text,
	`counterparty_user_id` text,
	`group_id` text,
	`note` text,
	`occurred_at` text NOT NULL,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counterparty_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `payments` ADD `exclude_from_pot` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `transferred_from_user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `credit_movements_user_id_idx` ON `credit_movements` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_movements_kind_cancelled_at_idx` ON `credit_movements` (`kind`,`cancelled_at`);--> statement-breakpoint
CREATE INDEX `credit_movements_group_id_idx` ON `credit_movements` (`group_id`);--> statement-breakpoint
DELETE FROM payment_allocations;--> statement-breakpoint
DELETE FROM payments;--> statement-breakpoint
DELETE FROM spendings;--> statement-breakpoint
DELETE FROM guest_deposits;--> statement-breakpoint
DELETE FROM charges;--> statement-breakpoint
UPDATE settings SET last_dues_generated_for = NULL;
