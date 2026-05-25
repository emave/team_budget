ALTER TABLE `payments` ADD `kind` text DEFAULT 'charge_payment' NOT NULL;
--> statement-breakpoint
UPDATE `payments`
SET `kind` = 'wallet_deposit'
WHERE `transferred_from_user_id` IS NULL
  AND `exclude_from_pot` = 0
  AND `id` NOT IN (
    SELECT `pa`.`payment_id`
    FROM `payment_allocations` AS `pa`
    INNER JOIN `charges` AS `c` ON `c`.`id` = `pa`.`charge_id`
    WHERE `c`.`type` != 'monthly_dues'
  );
