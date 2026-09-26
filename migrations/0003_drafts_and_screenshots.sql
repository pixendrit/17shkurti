-- Screenshots of the conversation an order came from, and quick orders
-- (drafts): caught in a hurry, completed into an order later.

CREATE TABLE order_screenshots (
	order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	image_id TEXT NOT NULL REFERENCES images (id),
	PRIMARY KEY (order_id, position)
);

CREATE TABLE drafts (
	id         TEXT PRIMARY KEY,
	created_at INTEGER NOT NULL,
	name       TEXT NOT NULL DEFAULT '',
	phone      TEXT NOT NULL DEFAULT '',
	note       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE draft_screenshots (
	draft_id TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	image_id TEXT NOT NULL REFERENCES images (id),
	PRIMARY KEY (draft_id, position)
);
