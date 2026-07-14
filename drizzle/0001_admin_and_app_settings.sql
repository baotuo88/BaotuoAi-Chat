-- Adds the admin role flag and a deployment-wide key/value settings table.
--
-- `users.is_admin` gates access to the admin panel (user list, quota/ban
-- management, registration toggle, password reset). Bootstrap the first
-- admin by setting it to true directly:
--   UPDATE "users" SET "is_admin" = true WHERE "email" = 'you@example.com';
--
-- `app_settings` stores runtime-editable deployment settings (currently the
-- new-registration on/off switch) so an admin can change them without a
-- redeploy. The seed row below defaults registration to enabled.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value")
VALUES ('registration_enabled', 'true')
ON CONFLICT ("key") DO NOTHING;
