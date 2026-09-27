-- What the shop commits to each week (named by its Monday), and how it goes.

CREATE TABLE priorities (
	id         TEXT PRIMARY KEY,
	week       TEXT NOT NULL,
	kind       TEXT NOT NULL CHECK (kind IN ('goal', 'daily')),
	title      TEXT NOT NULL CHECK (title <> ''),
	note       TEXT NOT NULL DEFAULT '',
	progress   INTEGER CHECK (progress BETWEEN 0 AND 100),
	due        TEXT,
	from_day   TEXT,
	created_at INTEGER NOT NULL,
	CHECK ((kind = 'goal') = (progress IS NOT NULL)),
	CHECK ((kind = 'daily') = (from_day IS NOT NULL))
);

-- The days a daily priority was done.
CREATE TABLE priority_days (
	priority_id TEXT NOT NULL REFERENCES priorities (id) ON DELETE CASCADE,
	day         TEXT NOT NULL,
	PRIMARY KEY (priority_id, day)
);
