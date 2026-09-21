/**
 * Demo data so the dashboard has something to show on first run.
 * Safe to re-run: it clears its own tables first. Never run against real data.
 */
import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.DATABASE_URL || 'file:./data/hijeshi.db',
	authToken: process.env.DATABASE_AUTH_TOKEN || undefined
});

const run = (sql, args = []) => db.execute({ sql, args });
const count = async (t) => Number((await db.execute(`SELECT count(*) c FROM ${t}`)).rows[0].c);

const now = Math.floor(Date.now() / 1000);
const day = 86400;

for (const t of ['order_items', 'orders', 'dtf_stock', 'blanks', 'designs', 'stock_log']) {
	await run(`DELETE FROM ${t}`);
}

const designNames = ['Shqiponja', 'Besa', 'Malësori', 'Tirana 1614', 'Iliria'];
const designIds = [];
for (const name of designNames) {
	const r = await run('INSERT INTO designs (name, created_at) VALUES (?, ?) RETURNING id', [name, now]);
	designIds.push(Number(r.rows[0].id));
}

const dtfQty = [6, 3, 0, 12, 1];
for (const [i, id] of designIds.entries()) {
	await run('INSERT INTO dtf_stock (design_id, quantity, unit_cost, on_order) VALUES (?, ?, ?, ?)', [
		id,
		dtfQty[i],
		250,
		i === 2 ? 20 : 0
	]);
}

const blankRows = [];
for (const color of ['White', 'Black']) {
	for (const size of ['S', 'M', 'L', 'XL']) {
		const qty = Math.floor(Math.random() * 8);
		await run('INSERT INTO blanks (product_type, color, size, quantity, unit_cost) VALUES (?,?,?,?,?)', [
			'T-Shirt',
			color,
			size,
			qty,
			600
		]);
		blankRows.push({ color, size });
	}
}

const firstNames = ['Arta', 'Enea', 'Blerim', 'Drita', 'Gent', 'Elira', 'Krenar', 'Rina', 'Ardit', 'Vesa'];
const surnames = ['Hoxha', 'Krasniqi', 'Shehu', 'Berisha'];
const cities = ['Tiranë', 'Durrës', 'Vlorë', 'Shkodër'];
const channels = ['instagram', 'instagram', 'tiktok', 'messenger', 'whatsapp'];
const statuses = ['new', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered'];
const sizes = ['S', 'M', 'L', 'XL'];

for (let i = 1; i <= 28; i++) {
	const age = Math.floor(Math.random() * 120);
	const status = age > 20 ? 'delivered' : statuses[Math.floor(Math.random() * statuses.length)];
	const created = now - age * day;

	const r = await run(
		`INSERT INTO orders (code, customer_name, phone, address, city, channel, status,
		 payment_status, payment_method, shipping_fee, discount, created_at, updated_at,
		 delivered_at, stock_deducted_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
		[
			`HS-${String(i).padStart(4, '0')}`,
			`${firstNames[i % firstNames.length]} ${surnames[i % surnames.length]}`,
			`06${Math.floor(10000000 + Math.random() * 89999999)}`,
			`Rruga e Durrësit ${i}`,
			cities[i % cities.length],
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
		]
	);
	const orderId = Number(r.rows[0].id);

	const itemCount = Math.random() > 0.75 ? 2 : 1;
	for (let k = 0; k < itemCount; k++) {
		const blank = blankRows[Math.floor(Math.random() * blankRows.length)];
		await run(
			`INSERT INTO order_items (order_id, product_type, color, size, design_id, quantity, unit_price, unit_cost)
			 VALUES (?,?,?,?,?,?,?,?)`,
			[
				orderId,
				'T-Shirt',
				blank.color,
				sizes[Math.floor(Math.random() * sizes.length)],
				designIds[Math.floor(Math.random() * designIds.length)],
				Math.random() > 0.85 ? 2 : 1,
				1500,
				850
			]
		);
	}
}

console.log('Seeded:', {
	designs: await count('designs'),
	blanks: await count('blanks'),
	orders: await count('orders'),
	items: await count('order_items')
});
