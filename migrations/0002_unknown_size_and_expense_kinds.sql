-- Shirts sold before the app can have an unknown size, and expenses can be
-- equipment, travel, or blanks/DTF bought before the app (spending only,
-- never stock). SQLite can't alter a CHECK, so both tables are rebuilt.
PRAGMA defer_foreign_keys = true;

CREATE TABLE order_lines_new (
	id               TEXT PRIMARY KEY,
	order_id         TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
	position         INTEGER NOT NULL,
	garment          TEXT NOT NULL CHECK (garment IN ('oversized_200g', 'regular_fit')),
	color            TEXT NOT NULL CHECK (color IN ('black', 'white')),
	size             TEXT NOT NULL CHECK (size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'unknown')),
	artwork          TEXT NOT NULL CHECK (artwork IN ('none', 'print', 'custom')),
	print_id         TEXT REFERENCES prints (id),
	front_image_id   TEXT REFERENCES images (id),
	back_image_id    TEXT REFERENCES images (id),
	print_ready      INTEGER NOT NULL DEFAULT 0 CHECK (print_ready IN (0, 1)),
	quantity         INTEGER NOT NULL CHECK (quantity >= 1),
	unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
	blank_cost_cents INTEGER NOT NULL CHECK (blank_cost_cents >= 0),
	dtf_cost_cents   INTEGER NOT NULL CHECK (dtf_cost_cents >= 0),
	labor_cost_cents INTEGER NOT NULL CHECK (labor_cost_cents >= 0),
	CHECK ((artwork = 'print') = (print_id IS NOT NULL)),
	CHECK ((artwork = 'custom') = (front_image_id IS NOT NULL AND back_image_id IS NOT NULL)),
	CHECK (artwork = 'custom' OR (front_image_id IS NULL AND back_image_id IS NULL AND print_ready = 0))
);
INSERT INTO order_lines_new SELECT * FROM order_lines;
DROP TABLE order_lines;
ALTER TABLE order_lines_new RENAME TO order_lines;
CREATE INDEX order_lines_order ON order_lines (order_id);

CREATE TABLE purchases_new (
	id                TEXT PRIMARY KEY,
	kind              TEXT NOT NULL CHECK (kind IN ('blanks', 'dtf', 'expense')),
	date              INTEGER NOT NULL,
	note              TEXT NOT NULL DEFAULT '',
	is_demo           INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
	sheets            INTEGER,
	sheet_price_cents INTEGER,
	category          TEXT,
	amount_cents      INTEGER,
	CHECK ((kind = 'dtf') = (sheets IS NOT NULL AND sheets >= 1 AND sheet_price_cents IS NOT NULL AND sheet_price_cents > 0)),
	CHECK ((kind = 'expense') = (category IN ('packaging', 'marketing', 'equipment', 'travel', 'blanks', 'dtf', 'other') AND amount_cents IS NOT NULL AND amount_cents > 0))
);
INSERT INTO purchases_new SELECT * FROM purchases;
DROP TABLE purchases;
ALTER TABLE purchases_new RENAME TO purchases;
