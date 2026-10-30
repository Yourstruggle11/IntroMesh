ALTER TABLE "intro_requests" ADD COLUMN "bounty_network" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "network" text DEFAULT 'testnet' NOT NULL;