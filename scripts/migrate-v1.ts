/**
 * One-off: moves the shop from the first database (REAL euros, designs split
 * by colour, a stock count per row) to the new schema.
 *
 *   tsx scripts/migrate-v1.ts <old-export.sql> <new-data.sql>
 *
 * writes new-data.sql and new-data.images.json. Load the pictures first (their
 * rows are too big for one SQL statement, so they go as bound parameters
 * through D1's REST API), then `wrangler d1 execute <db> --remote --file`.
 *
 * Reads a `wrangler d1 export` of the old database, maps every record to the
 * new data definitions, writes them through the real repository into a fresh
 * database with the new schema (so every CHECK constraint is applied), checks
 * the numbers match, and writes the result as SQL to load into the new D1.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { economics } from '../src/lib/domain/economics';
import { financials } from '../src/lib/domain/stats';
import { normalizePhone } from '../src/lib/domain/world';
import {
	DEFAULT_SETTINGS,
	SIZES,
	type Change,
	type Color,
	type Country,
	type Customer,
	type Design,
	type Garment,
	type Image,
	type Order,
	type OrderLine,
	type Payment,
	type Print,
	type Purchase
} from '../src/lib/domain/model';
import { commit, loadWorld } from '../src/lib/server/repo';
import { asD1, sqliteD1 } from '../src/lib/server/sqlite-d1';

const [oldFile, outFile] = process.argv.slice(2);
if (!oldFile || !outFile) throw new Error('usage: migrate-v1.ts <old-export.sql> <new-data.sql>');

const old = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
old.exec(readFileSync(oldFile, 'utf8'));
type Row = Record<string, any>;
const all = (sql: string) => old.prepare(sql).all() as Row[];

const cents = (euro: number | null) => Math.round((euro ?? 0) * 100);
const uuid = () => crypto.randomUUID();
const GARMENT: Record<string, Garment> = { 'Oversized 200g': 'oversized_200g', 'Regular Fit': 'regular_fit' };
const COLOR: Record<string, Color> = { Black: 'black', White: 'white' };
const METHOD = { cash_on_delivery: 'cod', bank_transfer: 'bank', cash: 'cash' } as const;

const changes: Change[] = [];

// ---- Designs: "UÇK Black" + "UÇK White" -> design "UÇK" printed for both colours
const images = new Map<string, Image>();
const imageOf = (mime: string, data: string, at: number): string => {
	const img: Image = { id: uuid(), mime: mime as Image['mime'], data, createdAt: at };
	images.set(img.id, img);
	changes.push({ put: 'image', value: img });
	return img.id;
};
const designs = new Map<string, Design>();
const printOfOldDesign = new Map<number, Print>();
for (const d of all('SELECT * FROM designs ORDER BY id')) {
	const m = /^(.*?)\s+(Black|White)$/.exec(d.name);
	const base = (m ? m[1] : d.name).trim();
	const color: Color = m ? COLOR[m[2]] : 'black';
	let design = designs.get(base.toLowerCase());
	if (!design) {
		design = { id: uuid(), name: base, notes: d.notes ?? '', archived: !!d.archived, createdAt: d.created_at };
		designs.set(base.toLowerCase(), design);
		changes.push({ put: 'design', value: design });
	}
	const pics = Object.fromEntries(
		all(`SELECT * FROM design_images WHERE design_id = ${d.id}`).map((i) => [i.side, imageOf(i.mime, i.data, i.updated_at)])
	);
	const p: Print = { id: uuid(), designId: design.id, shirtColor: color, perSheet: d.shirts_per_sheet, front: pics.front ?? null, back: pics.back ?? null };
	printOfOldDesign.set(d.id, p);
	changes.push({ put: 'print', value: p });
}

// ---- Customers: one per phone number; the latest order's details win
const customers = new Map<string, Customer>();
const oldOrders = all('SELECT * FROM orders ORDER BY created_at, id');
for (const o of oldOrders) {
	const key = normalizePhone(o.phone) || `${o.customer_name}`;
	const c: Customer = {
		id: customers.get(key)?.id ?? uuid(),
		name: o.customer_name.trim(),
		phone: o.phone.trim(),
		address: o.address ?? '',
		city: o.city ?? '',
		country: (['XK', 'AL', 'MK'].includes(o.country) ? o.country : 'OTHER') as Country
	};
	customers.set(key, c);
}
for (const c of customers.values()) changes.push({ put: 'customer', value: c });

// ---- Orders, their lines and payments
const itemsOf = new Map<number, Row[]>();
for (const i of all('SELECT * FROM order_items ORDER BY id')) itemsOf.set(i.order_id, [...(itemsOf.get(i.order_id) ?? []), i]);
const oldEconomics: { status: string; kind: string; revenue: number }[] = [];

for (const o of oldOrders) {
	const courier = o.delivery_method === 'post';
	const status: Order['status'] = o.status === 'shipped' ? 'with_courier' : o.status;
	const made = ['ready', 'with_courier', 'delivered', 'returned'].includes(status) || (status === 'cancelled' && o.stock_deducted_at);
	const madeAt = made ? (o.stock_deducted_at ?? o.created_at) : null;
	const left = courier && ['with_courier', 'delivered', 'returned'].includes(status);
	const lines: OrderLine[] = (itemsOf.get(o.id) ?? []).map((i) => {
		let artwork: OrderLine['artwork'] = { kind: 'none' };
		if (i.is_custom) {
			const pics = Object.fromEntries(all(`SELECT * FROM order_item_images WHERE item_id = ${i.id}`).map((x) => [x.side, imageOf(x.mime, x.data, x.updated_at)]));
			if (!pics.front || !pics.back) throw new Error(`${o.code}: a custom item without both mockups`);
			artwork = { kind: 'custom', front: pics.front, back: pics.back, printReady: !!i.custom_print_ready };
		} else if (i.design_id) {
			artwork = { kind: 'print', printId: printOfOldDesign.get(i.design_id)!.id };
		}
		const split = i.blank_cost + i.dtf_cost + i.labor_cost > 0;
		return {
			id: uuid(),
			sku: { garment: GARMENT[i.product_type], color: COLOR[i.color], size: i.size },
			artwork,
			quantity: i.quantity,
			unitPrice: o.kind === 'gift' ? 0 : cents(i.unit_price),
			cost: split
				? { blank: cents(i.blank_cost), dtf: cents(i.dtf_cost), labor: cents(i.labor_cost) }
				: { blank: cents(i.unit_cost), dtf: 0, labor: 0 }
		};
	});
	const order: Order = {
		id: uuid(),
		code: o.code,
		customerId: customers.get(normalizePhone(o.phone) || o.customer_name)!.id,
		kind: o.kind,
		channel: o.channel,
		delivery: courier
			? { method: 'courier', cost: cents(o.shipping_cost), trackingRef: o.tracking_ref ?? '' }
			: { method: 'hand', cost: cents(o.shipping_cost) },
		lines,
		packaging: cents(o.packaging_cost),
		shippingCharged: o.kind === 'gift' ? 0 : cents(o.shipping_fee),
		discount: o.kind === 'gift' ? 0 : cents(o.discount),
		notes: o.notes ?? '',
		status,
		// Shirts made before the ledger were never on its shelf.
		stockTracked: !made,
		isDemo: !!o.is_demo,
		createdAt: o.created_at,
		madeAt,
		handedOverAt: left ? (o.shipped_at ?? madeAt) : null,
		deliveredAt: status === 'delivered' ? (o.delivered_at ?? o.shipped_at ?? o.created_at) : null,
		returnedAt: status === 'returned' ? o.updated_at : null,
		cancelledAt: status === 'cancelled' ? o.updated_at : null
	};
	changes.push({ put: 'order', value: order });

	const revenue = economics(order).revenue;
	oldEconomics.push({ status: o.status, kind: o.kind, revenue });
	if (o.payment_status === 'paid' && order.kind === 'sale' && revenue > 0) {
		const p: Payment = {
			id: uuid(),
			orderId: order.id,
			amount: revenue,
			method: METHOD[o.payment_method as keyof typeof METHOD] ?? 'cash',
			receivedAt: o.paid_at ?? o.delivered_at ?? o.created_at
		};
		changes.push({ put: 'payment', value: p });
	}
}

// ---- Expenses -> purchases. Blank purchases didn't record sizes: the demo
// ones are spread evenly over black and white, S to XL, and put on the shelf.
for (const x of all('SELECT * FROM expenses ORDER BY date, id')) {
	const base = { id: uuid(), date: x.date, note: x.description ?? '', isDemo: !!x.is_demo };
	let p: Purchase;
	if (x.category === 'blanks' && x.quantity > 0) {
		const unitCost = Math.round(cents(x.amount) / x.quantity);
		const slots = (['black', 'white'] as const).flatMap((color) => (['S', 'M', 'L', 'XL'] as const).map((size) => ({ color, size })));
		const lines = slots
			.map((s, i) => ({ sku: { garment: 'oversized_200g' as const, ...s }, quantity: Math.floor(x.quantity / slots.length) + (i < x.quantity % slots.length ? 1 : 0), unitCost }))
			.filter((l) => l.quantity > 0);
		p = { ...base, kind: 'blanks', lines };
	} else if (x.category === 'dtf' && x.quantity > 0) {
		p = { ...base, kind: 'dtf', sheets: Math.round(x.quantity), sheetPrice: Math.round(cents(x.amount) / x.quantity), lines: [] };
	} else {
		p = { ...base, kind: 'expense', category: (['packaging', 'marketing'].includes(x.category) ? x.category : 'other') as 'other', amount: cents(x.amount) };
	}
	changes.push({ put: 'purchase', value: p });
	if (p.kind === 'blanks')
		for (const l of p.lines)
			changes.push({ put: 'movement', value: { id: uuid(), subject: { kind: 'blank', sku: l.sku }, delta: l.quantity, reason: 'purchase', note: '', orderId: null, purchaseId: p.id, at: p.date } });
}

// ---- Settings (the old database used the defaults, stored or not)
const stored = all(`SELECT value FROM settings WHERE key = 'costs'`)[0];
if (stored) {
	const s = JSON.parse(stored.value);
	changes.push({
		put: 'settings',
		value: {
			defaultPrice: cents(s.defaultPrice),
			sheetPrice: cents(s.dtfSheetPrice),
			customPerSheet: s.customShirtsPerSheet,
			laborPerShirt: cents(s.laborPerShirt),
			packagingPerOrder: cents(s.packagingPerOrder),
			blankCost: { oversized_200g: cents(s.blankCost['Oversized 200g']), regular_fit: cents(s.blankCost['Regular Fit']) },
			courierCost: { XK: cents(s.postCost.XK), AL: cents(s.postCost.AL), MK: cents(s.postCost.MK), OTHER: cents(s.postCost.OTHER) }
		}
	});
}

// ---- Write through the repository into a fresh database, then check.
const fresh = sqliteD1().migrate();
await commit(asD1(fresh), changes);
const w = await loadWorld(asD1(fresh));

const check = (what: string, a: unknown, b: unknown) => {
	const okay = JSON.stringify(a) === JSON.stringify(b);
	console.log(`${okay ? '✓' : '✗'} ${what}: ${JSON.stringify(a)}${okay ? '' : ` ≠ ${JSON.stringify(b)}`}`);
	if (!okay) process.exitCode = 1;
};
const s = financials(w, 0, Math.floor(Date.now() / 1000));
check('orders', w.orders.length, oldOrders.length);
check('lines', w.orders.reduce((a, o) => a + o.lines.length, 0), all('SELECT COUNT(*) n FROM order_items')[0].n);
check('real orders', w.orders.filter((o) => !o.isDemo).length, all('SELECT COUNT(*) n FROM orders WHERE is_demo = 0')[0].n);
check('customers', w.customers.length, customers.size);
check('designs', w.designs.map((d) => d.name).sort(), [...designs.values()].map((d) => d.name).sort());
check('prints', w.prints.length, all('SELECT COUNT(*) n FROM designs')[0].n);
check('images', (fresh.raw.prepare('SELECT COUNT(*) n FROM images').get() as Row).n, images.size);
check(
	'revenue (all time, cents)',
	s.revenue,
	oldEconomics.filter((e) => e.kind === 'sale' && !['cancelled', 'returned'].includes(e.status)).reduce((a, e) => a + e.revenue, 0)
);
check('paid orders', w.payments.length, all(`SELECT COUNT(*) n FROM orders WHERE payment_status = 'paid' AND kind = 'sale'`)[0].n);
check('money spent (cents)', s.spent, cents(all('SELECT SUM(amount) t FROM expenses')[0].t));
console.log('net (all time):', s.net / 100, '€ · outstanding:', s.outstanding / 100, '€ · collected:', s.collected / 100, '€');

// ---- Dump the data as SQL for `wrangler d1 execute --file`. Pictures go to
// a separate JSON file: D1 limits one SQL statement to 100 KB, so they must
// be sent as bound parameters (see the REST call in the README), first.
const imageRows = fresh.raw.prepare('SELECT * FROM images').all();
writeFileSync(outFile.replace(/\.sql$/, '') + '.images.json', JSON.stringify(imageRows));
console.log(`wrote ${imageRows.length} pictures to ${outFile.replace(/\.sql$/, '')}.images.json`);
const TABLES = ['customers', 'designs', 'prints', 'orders', 'order_lines', 'payments', 'purchases', 'purchase_lines', 'stock_movements', 'garment_costs', 'courier_costs', 'settings'];
const lit = (v: unknown) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const out: string[] = [];
for (const t of TABLES) {
	for (const r of fresh.raw.prepare(`SELECT * FROM ${t}`).all() as Row[]) {
		const cols = Object.keys(r);
		out.push(`INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${cols.map((c) => lit(r[c])).join(', ')});`);
	}
}
writeFileSync(outFile, out.join('\n') + '\n');
console.log(`wrote ${out.length} rows to ${outFile}`);
