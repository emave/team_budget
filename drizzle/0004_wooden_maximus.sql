CREATE TABLE `guest_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`note` text,
	`received_at` text NOT NULL,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guest_deposits_guest_id_idx` ON `guest_deposits` (`guest_id`);--> statement-breakpoint
CREATE INDEX `guest_deposits_received_at_idx` ON `guest_deposits` (`received_at`);
