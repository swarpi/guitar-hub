ALTER TABLE songs ADD COLUMN instrument TEXT NOT NULL DEFAULT 'guitar';
--> statement-breakpoint
ALTER TABLE songs RENAME COLUMN tab_content TO content;
--> statement-breakpoint
DROP INDEX IF EXISTS songs_artist_slug_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX songs_artist_slug_instrument_unique ON songs(artist_id, slug, instrument);
