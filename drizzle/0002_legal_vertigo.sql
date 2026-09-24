CREATE TABLE `design_images` (
	`design_id` integer NOT NULL,
	`side` text NOT NULL,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`design_id`, `side`),
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade
);
