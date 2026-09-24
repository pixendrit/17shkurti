CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`quantity` real,
	`amount` real NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expenses_date_idx` ON `expenses` (`date`);--> statement-breakpoint
CREATE TABLE `order_item_images` (
	`item_id` integer NOT NULL,
	`side` text NOT NULL,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`item_id`, `side`),
	FOREIGN KEY (`item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `designs` ADD `shirts_per_sheet` integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `blank_cost` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `dtf_cost` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `labor_cost` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `is_custom` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `custom_print_ready` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `kind` text DEFAULT 'sale' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_method` text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `country` text DEFAULT 'XK' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_cost` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `packaging_cost` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_ref` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipped_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_tracking_idx` ON `orders` (`tracking_ref`);--> statement-breakpoint
-- 'confirmed' was folded into 'new': orders are confirmed in the DM before they are entered.
UPDATE `orders` SET `status` = 'new' WHERE `status` = 'confirmed';
