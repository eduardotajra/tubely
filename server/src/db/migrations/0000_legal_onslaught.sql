CREATE TABLE IF NOT EXISTS "conversions" (
	"id" text PRIMARY KEY NOT NULL,
	"youtube_url" text NOT NULL,
	"video_id" text NOT NULL,
	"title" text,
	"author" text,
	"thumbnail_url" text,
	"duration" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"file_url" text,
	"file_key" text,
	"error_msg" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
