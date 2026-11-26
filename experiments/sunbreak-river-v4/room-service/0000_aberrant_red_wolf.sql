CREATE TABLE `lobbyrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`state` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lobbyrooms_expires_idx` ON `lobbyrooms` (`expires`);