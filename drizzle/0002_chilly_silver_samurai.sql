CREATE TABLE `processing_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processing_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `progress` int DEFAULT 0 NOT NULL;