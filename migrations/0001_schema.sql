-- The shop's database. Tables mirror the data definitions in
-- src/lib/domain/model.ts; CHECK constraints hold what the types say, so a
-- bad row can't be written even by mistake. Money is *_cents INTEGER.
-- Times are Unix seconds. Ids are UUIDs made by the app.

CREATE TABLE settings (
	id                        INTEGER PRIMARY KEY CHECK (id = 1),
	default_price_cents       INTEGER NOT NULL CHECK (default_price_cents >= 0),
	sheet_price_cents         INTEGER NOT NULL CHECK (sheet_price_cents >= 0),
	custom_per_sheet          INTEGER NOT NULL CHECK (custom_per_sheet BETWEEN 1 AND 100),
	labor_per_shirt_cents     INTEGER NOT NULL CHECK (labor_per_shirt_cents >= 0),
	packaging_per_order_cents INTEGER NOT NULL CHECK (packaging_per_order_cents >= 0)
);

CREATE TABLE garment_costs (
	garment          TEXT PRIMARY KEY CHECK (garment IN ('oversized_200g', 'regular_fit')),
	blank_cost_cents INTEGER NOT NULL CHECK (blank_cost_cents >= 0)
);

CREATE TABLE courier_costs (
	country    TEXT PRIMARY KEY CHECK (country IN ('XK', 'AL', 'MK', 'OTHER')),
	cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0)
);

INSERT INTO settings VALUES (1, 2500, 1200, 4, 200, 12);
INSERT INTO garment_costs VALUES ('oversized_200g', 800), ('regular_fit', 800);
INSERT INTO courier_costs VALUES ('XK', 250), ('AL', 500), ('MK', 500), ('OTHER', 500);

CREATE TABLE customers (
	id      TEXT PRIMARY KEY,
	name    TEXT NOT NULL CHECK (name <> ''),
	phone   TEXT NOT NULL CHECK (phone <> ''),
	address TEXT NOT NULL DEFAULT '',
	city    TEXT NOT NULL DEFAULT '',
	country TEXT NOT NULL CHECK (country IN ('XK', 'AL', 'MK', 'OTHER'))
);
CREATE INDEX customers_phone ON customers (phone);

CREATE TABLE images (
	id         TEXT PRIMARY KEY,
	mime       TEXT NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg', 'image/png')),
	data       TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE designs (
	id         TEXT PRIMARY KEY,
	name       TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (name <> ''),
	notes      TEXT NOT NULL DEFAULT '',
	archived   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
	created_at INTEGER NOT NULL
);

CREATE TABLE prints (
	id             TEXT PRIMARY KEY,
	design_id      TEXT NOT NULL REFERENCES designs (id),
	shirt_color    TEXT NOT NULL CHECK (shirt_color IN ('black', 'white')),
	per_sheet      INTEGER NOT NULL CHECK (per_sheet BETWEEN 1 AND 100),
	front_image_id TEXT REFERENCES images (id),
	back_image_id  TEXT REFERENCES images (id),
	UNIQUE (design_id, shirt_color)
);

CREATE TABLE orders (
	id                     TEXT PRIMARY KEY,
	code                   TEXT NOT NULL UNIQUE,
	customer_id            TEXT NOT NULL REFERENCES customers (id),
	kind                   TEXT NOT NULL CHECK (kind IN ('sale', 'gift')),
	channel                TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'tiktok', 'whatsapp', 'direct', 'other')),
	delivery_method        TEXT NOT NULL CHECK (delivery_method IN ('courier', 'hand')),
	delivery_cost_cents    INTEGER NOT NULL CHECK (delivery_cost_cents >= 0),
	tracking_ref           TEXT NOT NULL DEFAULT '',
	packaging_cents        INTEGER NOT NULL CHECK (packaging_cents >= 0),
	shipping_charged_cents INTEGER NOT NULL CHECK (shipping_charged_cents >= 0),
	discount_cents         INTEGER NOT NULL CHECK (discount_cents >= 0),
	notes                  TEXT NOT NULL DEFAULT '',
	status                 TEXT NOT NULL CHECK (status IN ('new', 'in_production', 'ready', 'with_courier', 'delivered', 'returned', 'cancelled')),
	stock_tracked          INTEGER NOT NULL CHECK (stock_tracked IN (0, 1)),
	is_demo                INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
	created_at             INTEGER NOT NULL,
	made_at                INTEGER,
	handed_over_at         INTEGER,
	delivered_at           INTEGER,
	returned_at            INTEGER,
	cancelled_at           INTEGER,
	-- Only parcels have a courier reference, and only parcels go to the courier.
	CHECK (delivery_method = 'courier' OR (tracking_ref = '' AND handed_over_at IS NULL)),
	-- Gifts are free.
	CHECK (kind = 'sale' OR (shipping_charged_cents = 0 AND discount_cents = 0)),
	-- Each status has the moment that led to it.
	CHECK (status NOT IN ('ready', 'with_courier', 'delivered', 'returned') OR made_at IS NOT NULL),
	CHECK (status NOT IN ('with_courier', 'returned') OR handed_over_at IS NOT NULL),
	CHECK (status <> 'delivered' OR delivered_at IS NOT NULL),
	CHECK (status <> 'returned' OR returned_at IS NOT NULL),
	CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
);
CREATE INDEX orders_customer ON orders (customer_id);
CREATE INDEX orders_created ON orders (created_at);

CREATE TABLE order_lines (
	id               TEXT PRIMARY KEY,
	order_id         TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
	position         INTEGER NOT NULL,
	garment          TEXT NOT NULL CHECK (garment IN ('oversized_200g', 'regular_fit')),
	color            TEXT NOT NULL CHECK (color IN ('black', 'white')),
	size             TEXT NOT NULL CHECK (size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
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
	-- A catalogue line names its print; a custom line has both mockups.
	CHECK ((artwork = 'print') = (print_id IS NOT NULL)),
	CHECK ((artwork = 'custom') = (front_image_id IS NOT NULL AND back_image_id IS NOT NULL)),
	CHECK (artwork = 'custom' OR (front_image_id IS NULL AND back_image_id IS NULL AND print_ready = 0))
);
CREATE INDEX order_lines_order ON order_lines (order_id);

CREATE TABLE payments (
	id           TEXT PRIMARY KEY,
	order_id     TEXT NOT NULL REFERENCES orders (id),
	amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
	method       TEXT NOT NULL CHECK (method IN ('cod', 'bank', 'cash')),
	received_at  INTEGER NOT NULL
);
CREATE INDEX payments_order ON payments (order_id);

CREATE TABLE purchases (
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
	CHECK ((kind = 'expense') = (category IN ('packaging', 'marketing', 'other') AND amount_cents IS NOT NULL AND amount_cents > 0))
);

CREATE TABLE purchase_lines (
	purchase_id     TEXT NOT NULL REFERENCES purchases (id) ON DELETE CASCADE,
	position        INTEGER NOT NULL,
	garment         TEXT CHECK (garment IN ('oversized_200g', 'regular_fit')),
	color           TEXT CHECK (color IN ('black', 'white')),
	size            TEXT CHECK (size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
	print_id        TEXT REFERENCES prints (id),
	quantity        INTEGER NOT NULL CHECK (quantity >= 1),
	unit_cost_cents INTEGER,
	PRIMARY KEY (purchase_id, position),
	-- A line is either blanks (with what each cost) or prints.
	CHECK ((print_id IS NULL) = (garment IS NOT NULL AND color IS NOT NULL AND size IS NOT NULL AND unit_cost_cents IS NOT NULL))
);

CREATE TABLE stock_movements (
	id          TEXT PRIMARY KEY,
	garment     TEXT CHECK (garment IN ('oversized_200g', 'regular_fit')),
	color       TEXT CHECK (color IN ('black', 'white')),
	size        TEXT CHECK (size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
	print_id    TEXT REFERENCES prints (id),
	delta       INTEGER NOT NULL CHECK (delta <> 0),
	reason      TEXT NOT NULL CHECK (reason IN ('opening', 'purchase', 'made', 'unmade', 'adjustment')),
	note        TEXT NOT NULL DEFAULT '',
	order_id    TEXT REFERENCES orders (id),
	purchase_id TEXT REFERENCES purchases (id),
	at          INTEGER NOT NULL,
	-- Exactly one subject: a blank, or a print.
	CHECK ((print_id IS NULL) = (garment IS NOT NULL AND color IS NOT NULL AND size IS NOT NULL)),
	CHECK (print_id IS NULL OR (garment IS NULL AND color IS NULL AND size IS NULL)),
	-- Every movement says where it came from.
	CHECK (reason NOT IN ('made', 'unmade') OR order_id IS NOT NULL),
	CHECK (reason <> 'purchase' OR purchase_id IS NOT NULL)
);

CREATE TABLE login_attempts (
	ip           TEXT PRIMARY KEY,
	count        INTEGER NOT NULL DEFAULT 0,
	locked_until INTEGER NOT NULL DEFAULT 0
);
