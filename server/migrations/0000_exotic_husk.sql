CREATE TABLE `advertisements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(100) NOT NULL,
	`content_type` enum('image','video','text','html') NOT NULL,
	`content_url` varchar(500),
	`content_text` text,
	`area_id` int,
	`active` boolean NOT NULL DEFAULT true,
	`duration_seconds` int NOT NULL DEFAULT 10,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `advertisements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `areas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(500),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `areas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service_id` int NOT NULL,
	`date` date NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `daily_sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dispenser_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`area_id` int NOT NULL,
	`user_id` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispenser_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `display_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`area_id` int NOT NULL,
	`user_id` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `display_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`area_id` int NOT NULL,
	`ticket_format` enum('numeric','alphanumeric','custom') NOT NULL,
	`ticket_prefix` varchar(10),
	`ticket_digit_count` int NOT NULL DEFAULT 3,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`area_id` int NOT NULL,
	`reception_user_id` int,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`sequence_number` int NOT NULL,
	`service_id` int NOT NULL,
	`area_id` int NOT NULL,
	`status` enum('waiting','called','in_service','completed','cancelled','no_show') NOT NULL,
	`station_id` int,
	`called_at` timestamp,
	`started_at` timestamp,
	`completed_at` timestamp,
	`call_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`date` date NOT NULL,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('root','admin','reception','management','display','dispenser') NOT NULL,
	`area_id` int,
	`station_id` int,
	`active` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `voice_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`area_id` int NOT NULL,
	`language` varchar(10) NOT NULL DEFAULT 'pt',
	`voice_name` varchar(50),
	`speed` real NOT NULL DEFAULT 1,
	`voice_text_template` text NOT NULL DEFAULT ('Senha {ticketNumber}, dirija-se à {stationName}'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voice_configs_id` PRIMARY KEY(`id`)
);
