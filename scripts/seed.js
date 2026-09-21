/**
 * Demo data so the dashboard has something to show on first run.
 * Safe to re-run: it clears its own tables first. Never run against real data.
 */
import Database from 'better-sqlite3';

const path = process.env.DATABASE_PATH || './data/hijeshi.db';
const db = new Database(path);
db.pragma('foreign_keys = ON');

const now = Math.floor(Date.now() / 1000);
const day = 86400;

db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM dtf_stock; DELETE FROM blanks; DELETE FROM designs; DELETE FROM stock_log;');

const designNames = ['Shqiponja', 'Besa', 'Malësori', 'Tirana 1614', 'Iliria'];
const designIds = designNames.map(
	(n) => db.prepare('INSERT INTO designs (name, created_at) VALUES (?, ?)').run(n, now).lastInsertRowid
);

for (const [i, id] of designIds.entries()) {
	db.prepare('INSERT INTO dtf_stock (design_id, quantity, unit_cost, on_order) VALUES (?, ?, ?, ?)').run(
		id,
		[6, 3, 0, 12, 1][i],
		250,
		i === 2 ? 20 : 0
	);
}

for (const color of ['White', 'Black']) {
	for (const size of ['S', 'M', 'L', 'XL']) {
		db.prepare(
			'INSERT INTO blanks (product_type, color, size, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)'
		).run('T-Shirt', color, size, Math.floor(Math.random() * 8), 600);
	}
}

const firstNames = ['Arta', 'Enea', 'Blerim', 'Drita', 'Gent', 'Elira', 'Krenar', 'Rina', 'Ardit', 'Vesa'];
const channels = ['instagram', 'instagram', 'tiktok', 'messenger', 'whatsapp'];
const statuses = ['new', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered'];
const sizes = ['S', 'M', 'L', 'XL'];

const blankRows = db.prepare('SELECT * FROM blanks').all();

for (let i = 1; i <= 28; i++) {
	const age = Math.floor(Math.random() * 120);
	const status = age > 20 ? 'delivered' : statuses[Math.floor(Math.random() * statuses.length)];
	const created = now - age * day;

	const info = db
		.prepare(
			`INSERT INTO orders (code, customer_name, phone, address, city, channel, status,
			 payment_status, payment_method, shipping_fee, discount, created_at, updated_at, delivered_at, stock_deducted_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
		)
		.run(
			`HS-${String(i).padStart(4, '0')}`,
			`${firstNames[i % firstNames.length]} ${['Hoxha', 'Krasniqi', 'Shehu', 'Berisha'][i % 4]}`,
			`06${Math.floor(10000000 + Math.random() * 89999999)}`,
			`Rruga e Durrësit ${i}`,
			['Tiranë', 'Durrës', 'Vlorë', 'Shkodër'][i % 4],
			channels[i % channels.length],
			status,
			status === 'delivered' || Math.random() > 0.5 ? 'paid' : 'unpaid',
			'cash_on_delivery',
			300,
			0,
			created,
			created,
			status === 'delivered' ? created + 2 * day : null,
			['ready', 'shipped', 'delivered'].includes(status) ? created + day : null
		);

	const itemCount = Math.random() > 0.75 ? 2 : 1;
	for (let k = 0; k < itemCount; k++) {
		const blank = blankRows[Math.floor(Math.random() * blankRows.length)];
		db.prepare(
			`INSERT INTO order_items (order_id, product_type, color, size, design_id, quantity, unit_price, unit_cost)
			 VALUES (?,?,?,?,?,?,?,?)`
		).run(
			info.lastInsertRowid,
			'T-Shirt',
			blank.color,
			sizes[Math.floor(Math.random() * sizes.length)],
			designIds[Math.floor(Math.random() * designIds.length)],
			Math.random() > 0.85 ? 2 : 1,
			1500,
			850
		);
	}
}

const counts = {
	designs: db.prepare('SELECT count(*) c FROM designs').get().c,
	blanks: db.prepare('SELECT count(*) c FROM blanks').get().c,
	orders: db.prepare('SELECT count(*) c FROM orders').get().c,
	items: db.prepare('SELECT count(*) c FROM order_items').get().c
};
console.log('Seeded:', counts);
db.close();
