-- Keeping clients informed: when each client was told their order is
-- ready, on its way, delivered; and the messages the shop sends.

CREATE TABLE order_notifications (
	order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
	stage    TEXT NOT NULL CHECK (stage IN ('ready', 'shipped', 'delivered')),
	at       INTEGER NOT NULL,
	PRIMARY KEY (order_id, stage)
);

CREATE TABLE message_templates (
	stage TEXT PRIMARY KEY CHECK (stage IN ('ready', 'shipped', 'delivered')),
	body  TEXT NOT NULL CHECK (body <> '')
);

INSERT INTO message_templates VALUES
	('ready', 'Përshëndetje {emri}! Porosia juaj {kodi} ({bluzat}) është gati. Për pagesë: {per_pagese}. Faleminderit që zgjodhët Hijeshi Shqiptare!'),
	('shipped', 'Përshëndetje {emri}! Porosia juaj {kodi} u nis me postë sot. Nr. i dërgesës: {nr_dergeses}. Arrin brenda 1–3 ditësh; pagesa në dorëzim: {per_pagese}. Faleminderit!'),
	('delivered', 'Përshëndetje {emri}! Shpresojmë që bluza t’ju pëlqejë 🇦🇱 Na bëni tag në Instagram kur ta vishni. Faleminderit që zgjodhët Hijeshi Shqiptare!');

-- Orders already past these steps were handled before the app tracked it:
-- they don't need a message now.
INSERT INTO order_notifications (order_id, stage, at)
SELECT id, CASE status WHEN 'ready' THEN 'ready' WHEN 'with_courier' THEN 'shipped' ELSE 'delivered' END, unixepoch()
FROM orders WHERE status IN ('ready', 'with_courier', 'delivered');
