CREATE TABLE `station_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`station_id` int NOT NULL,
	`service_id` int NOT NULL,
	CONSTRAINT `station_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `services` ADD `is_priority` boolean DEFAULT false NOT NULL;