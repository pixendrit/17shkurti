/**
 * The repository: the only code that knows the database. Two operations:
 *
 *   loadWorld(db) : World         — everything, in ONE round trip
 *   commit(db, changes)           — the changes, in ONE atomic batch
 *
 * plus reading a picture's data, which the world leaves out.
 */
import {
	COUNTRIES,
	GARMENTS,
	type Change,
	type Customer,
	type Design,
	type Image,
	type Movement,
	type Order,
	type OrderLine,
	type Payment,
	type Print,
	type Purchase,
	type Settings,
	type Subject,
	type World
} from '../domain/model';

type Row = Record<string, unknown>;
type Value = string | number | null;

// ---- Reading ------------------------------------------------------------------

const READS = {
	settings: 'SELECT * FROM settings WHERE id = 1',
	garmentCosts: 'SELECT * FROM garment_costs',
	courierCosts: 'SELECT * FROM courier_costs',
	customers: 'SELECT * FROM customers',
	designs: 'SELECT * FROM designs ORDER BY created_at, name',
	prints: 'SELECT * FROM prints',
	orders: 'SELECT * FROM orders ORDER BY created_at, code',
	lines: 'SELECT * FROM order_lines ORDER BY order_id, position',
	payments: 'SELECT * FROM payments ORDER BY received_at',
	purchases: 'SELECT * FROM purchases ORDER BY date',
	purchaseLines: 'SELECT * FROM purchase_lines ORDER BY purchase_id, position',
	movements: 'SELECT * FROM stock_movements ORDER BY at, id'
} as const;

/** loadWorld : D1 -> World — the whole shop, in one batched round trip. */
export async function loadWorld(db: D1Database): Promise<World> {
	const keys = Object.keys(READS) as (keyof typeof READS)[];
	const results = await db.batch(keys.map((k) => db.prepare(READS[k])));
	const r = Object.fromEntries(keys.map((k, i) => [k, (results[i].results ?? []) as Row[]])) as Record<
		keyof typeof READS,
		Row[]
	>;
	return toWorld(r);
}

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => Number(v);
const opt = (v: unknown) => (v == null ? null : Number(v));
const bool = (v: unknown) => Number(v) === 1;

/** toWorld : the tables' rows -> World */
export function toWorld(r: Record<keyof typeof READS, Row[]>): World {
	const s = r.settings[0];
	const settings: Settings = {
		defaultPrice: num(s.default_price_cents),
		sheetPrice: num(s.sheet_price_cents),
		customPerSheet: num(s.custom_per_sheet),
		laborPerShirt: num(s.labor_per_shirt_cents),
		packagingPerOrder: num(s.packaging_per_order_cents),
		blankCost: Object.fromEntries(GARMENTS.map((g) => [g, num(r.garmentCosts.find((x) => x.garment === g)?.blank_cost_cents ?? 0)])) as Settings['blankCost'],
		courierCost: Object.fromEntries(COUNTRIES.map((c) => [c, num(r.courierCosts.find((x) => x.country === c)?.cost_cents ?? 0)])) as Settings['courierCost']
	};

	const linesByOrder = new Map<string, OrderLine[]>();
	for (const l of r.lines) {
		const list = linesByOrder.get(str(l.order_id)) ?? [];
		list.push(toLine(l));
		linesByOrder.set(str(l.order_id), list);
	}
	const purchaseLines = new Map<string, Row[]>();
	for (const l of r.purchaseLines) {
		const list = purchaseLines.get(str(l.purchase_id)) ?? [];
		list.push(l);
		purchaseLines.set(str(l.purchase_id), list);
	}

	return {
		settings,
		customers: r.customers.map(
			(c): Customer => ({
				id: str(c.id),
				name: str(c.name),
				phone: str(c.phone),
				address: str(c.address),
				city: str(c.city),
				country: str(c.country) as Customer['country']
			})
		),
		designs: r.designs.map(
			(d): Design => ({
				id: str(d.id),
				name: str(d.name),
				notes: str(d.notes),
				archived: bool(d.archived),
				createdAt: num(d.created_at)
			})
		),
		prints: r.prints.map(
			(p): Print => ({
				id: str(p.id),
				designId: str(p.design_id),
				shirtColor: str(p.shirt_color) as Print['shirtColor'],
				perSheet: num(p.per_sheet),
				front: p.front_image_id == null ? null : str(p.front_image_id),
				back: p.back_image_id == null ? null : str(p.back_image_id)
			})
		),
		orders: r.orders.map((o) => toOrder(o, linesByOrder.get(str(o.id)) ?? [])),
		payments: r.payments.map(
			(p): Payment => ({
				id: str(p.id),
				orderId: str(p.order_id),
				amount: num(p.amount_cents),
				method: str(p.method) as Payment['method'],
				receivedAt: num(p.received_at)
			})
		),
		purchases: r.purchases.map((p) => toPurchase(p, purchaseLines.get(str(p.id)) ?? [])),
		movements: r.movements.map(
			(m): Movement => ({
				id: str(m.id),
				subject: toSubject(m),
				delta: num(m.delta),
				reason: str(m.reason) as Movement['reason'],
				note: str(m.note),
				orderId: m.order_id == null ? null : str(m.order_id),
				purchaseId: m.purchase_id == null ? null : str(m.purchase_id),
				at: num(m.at)
			})
		)
	};
}

const toSku = (r: Row) => ({
	garment: str(r.garment) as OrderLine['sku']['garment'],
	color: str(r.color) as OrderLine['sku']['color'],
	size: str(r.size) as OrderLine['sku']['size']
});

const toSubject = (r: Row): Subject =>
	r.print_id == null ? { kind: 'blank', sku: toSku(r) } : { kind: 'print', printId: str(r.print_id) };

function toLine(l: Row): OrderLine {
	const artwork: OrderLine['artwork'] =
		l.artwork === 'print'
			? { kind: 'print', printId: str(l.print_id) }
			: l.artwork === 'custom'
				? { kind: 'custom', front: str(l.front_image_id), back: str(l.back_image_id), printReady: bool(l.print_ready) }
				: { kind: 'none' };
	return {
		id: str(l.id),
		sku: toSku(l),
		artwork,
		quantity: num(l.quantity),
		unitPrice: num(l.unit_price_cents),
		cost: { blank: num(l.blank_cost_cents), dtf: num(l.dtf_cost_cents), labor: num(l.labor_cost_cents) }
	};
}

function toOrder(o: Row, lines: OrderLine[]): Order {
	const cost = num(o.delivery_cost_cents);
	return {
		id: str(o.id),
		code: str(o.code),
		customerId: str(o.customer_id),
		kind: str(o.kind) as Order['kind'],
		channel: str(o.channel) as Order['channel'],
		delivery:
			o.delivery_method === 'courier'
				? { method: 'courier', cost, trackingRef: str(o.tracking_ref) }
				: { method: 'hand', cost },
		lines,
		packaging: num(o.packaging_cents),
		shippingCharged: num(o.shipping_charged_cents),
		discount: num(o.discount_cents),
		notes: str(o.notes),
		status: str(o.status) as Order['status'],
		stockTracked: bool(o.stock_tracked),
		isDemo: bool(o.is_demo),
		createdAt: num(o.created_at),
		madeAt: opt(o.made_at),
		handedOverAt: opt(o.handed_over_at),
		deliveredAt: opt(o.delivered_at),
		returnedAt: opt(o.returned_at),
		cancelledAt: opt(o.cancelled_at)
	};
}

function toPurchase(p: Row, lines: Row[]): Purchase {
	const base = { id: str(p.id), date: num(p.date), note: str(p.note), isDemo: bool(p.is_demo) };
	if (p.kind === 'blanks')
		return { ...base, kind: 'blanks', lines: lines.map((l) => ({ sku: toSku(l), quantity: num(l.quantity), unitCost: num(l.unit_cost_cents) })) };
	if (p.kind === 'dtf')
		return {
			...base,
			kind: 'dtf',
			sheets: num(p.sheets),
			sheetPrice: num(p.sheet_price_cents),
			lines: lines.map((l) => ({ printId: str(l.print_id), quantity: num(l.quantity) }))
		};
	return { ...base, kind: 'expense', category: str(p.category) as 'other', amount: num(p.amount_cents) };
}

/** getImage : D1 Id -> Image or null — one picture, with its data. */
export async function getImage(db: D1Database, id: string): Promise<Image | null> {
	const r = await db.prepare('SELECT * FROM images WHERE id = ?').bind(id).first<Row>();
	return r ? { id: str(r.id), mime: str(r.mime) as Image['mime'], data: str(r.data), createdAt: num(r.created_at) } : null;
}

// ---- Writing ------------------------------------------------------------------

/**
 * Table: how one kind of record becomes rows. `rows` flattens a value into
 * the rows of its table (and `children`, rows of an owned table).
 */
type Columns = readonly string[];

const COLS = {
	images: ['id', 'mime', 'data', 'created_at'],
	customers: ['id', 'name', 'phone', 'address', 'city', 'country'],
	designs: ['id', 'name', 'notes', 'archived', 'created_at'],
	prints: ['id', 'design_id', 'shirt_color', 'per_sheet', 'front_image_id', 'back_image_id'],
	orders: [
		'id', 'code', 'customer_id', 'kind', 'channel', 'delivery_method', 'delivery_cost_cents', 'tracking_ref',
		'packaging_cents', 'shipping_charged_cents', 'discount_cents', 'notes', 'status', 'stock_tracked', 'is_demo',
		'created_at', 'made_at', 'handed_over_at', 'delivered_at', 'returned_at', 'cancelled_at'
	],
	order_lines: [
		'id', 'order_id', 'position', 'garment', 'color', 'size', 'artwork', 'print_id', 'front_image_id',
		'back_image_id', 'print_ready', 'quantity', 'unit_price_cents', 'blank_cost_cents', 'dtf_cost_cents',
		'labor_cost_cents'
	],
	payments: ['id', 'order_id', 'amount_cents', 'method', 'received_at'],
	purchases: ['id', 'kind', 'date', 'note', 'is_demo', 'sheets', 'sheet_price_cents', 'category', 'amount_cents'],
	purchase_lines: ['purchase_id', 'position', 'garment', 'color', 'size', 'print_id', 'quantity', 'unit_cost_cents'],
	stock_movements: ['id', 'garment', 'color', 'size', 'print_id', 'delta', 'reason', 'note', 'order_id', 'purchase_id', 'at']
} as const satisfies Record<string, Columns>;

type Table = keyof typeof COLS;

/** The order puts are written in: a row only after what it points to. */
const PUT_ORDER: Table[] = [
	'images', 'customers', 'designs', 'prints', 'orders', 'order_lines', 'payments', 'purchases', 'purchase_lines', 'stock_movements'
];
/** The order deletes are done in: a row before what it points to. */
const DELETE_ORDER: Table[] = ['payments', 'stock_movements', 'orders', 'customers', 'purchases', 'prints', 'designs', 'images'];

const DELETE_TABLE: Record<Extract<Change, { delete: string }>['delete'], Table> = {
	order: 'orders',
	payment: 'payments',
	purchase: 'purchases',
	movement: 'stock_movements',
	image: 'images',
	design: 'designs',
	print: 'prints',
	customer: 'customers'
};

const b = (v: boolean) => (v ? 1 : 0);
const skuCols = (s: { garment: string; color: string; size: string } | null) => [s?.garment ?? null, s?.color ?? null, s?.size ?? null];

/** rowsOf : Change -> [(Table, [Value])] — the rows a put writes. */
function rowsOf(c: Extract<Change, { put: string }>): [Table, Value[]][] {
	switch (c.put) {
		case 'image': {
			const v = c.value;
			return [['images', [v.id, v.mime, v.data, v.createdAt]]];
		}
		case 'customer': {
			const v = c.value;
			return [['customers', [v.id, v.name, v.phone, v.address, v.city, v.country]]];
		}
		case 'design': {
			const v = c.value;
			return [['designs', [v.id, v.name, v.notes, b(v.archived), v.createdAt]]];
		}
		case 'print': {
			const v = c.value;
			return [['prints', [v.id, v.designId, v.shirtColor, v.perSheet, v.front, v.back]]];
		}
		case 'order': {
			const o = c.value;
			const d = o.delivery;
			return [
				['orders', [
					o.id, o.code, o.customerId, o.kind, o.channel, d.method, d.cost, d.method === 'courier' ? d.trackingRef : '',
					o.packaging, o.shippingCharged, o.discount, o.notes, o.status, b(o.stockTracked), b(o.isDemo),
					o.createdAt, o.madeAt, o.handedOverAt, o.deliveredAt, o.returnedAt, o.cancelledAt
				]],
				...o.lines.map((l, i): [Table, Value[]] => {
					const a = l.artwork;
					return ['order_lines', [
						l.id, o.id, i, ...skuCols(l.sku), a.kind,
						a.kind === 'print' ? a.printId : null,
						a.kind === 'custom' ? a.front : null,
						a.kind === 'custom' ? a.back : null,
						a.kind === 'custom' ? b(a.printReady) : 0,
						l.quantity, l.unitPrice, l.cost.blank, l.cost.dtf, l.cost.labor
					]];
				})
			];
		}
		case 'payment': {
			const v = c.value;
			return [['payments', [v.id, v.orderId, v.amount, v.method, v.receivedAt]]];
		}
		case 'purchase': {
			const p = c.value;
			const head: Value[] = [
				p.id, p.kind, p.date, p.note, b(p.isDemo),
				p.kind === 'dtf' ? p.sheets : null,
				p.kind === 'dtf' ? p.sheetPrice : null,
				p.kind === 'expense' ? p.category : null,
				p.kind === 'expense' ? p.amount : null
			];
			const lines: Value[][] =
				p.kind === 'blanks'
					? p.lines.map((l, i) => [p.id, i, ...skuCols(l.sku), null, l.quantity, l.unitCost])
					: p.kind === 'dtf'
						? p.lines.map((l, i) => [p.id, i, null, null, null, l.printId, l.quantity, null])
						: [];
			return [['purchases', head], ...lines.map((l): [Table, Value[]] => ['purchase_lines', l])];
		}
		case 'movement': {
			const m = c.value;
			const s = m.subject;
			return [['stock_movements', [
				m.id, ...skuCols(s.kind === 'blank' ? s.sku : null), s.kind === 'print' ? s.printId : null,
				m.delta, m.reason, m.note, m.orderId, m.purchaseId, m.at
			]]];
		}
		case 'settings':
			return []; // written by settingsStatements
	}
}

/** D1 binds at most 100 values to one statement. */
const MAX_PARAMS = 100;

/** chunk : [X] Number -> [[X]] — the list in pieces of at most n. */
const chunk = <X>(xs: X[], n: number): X[][] =>
	Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * upserts : Table [[Value]] -> [SQL, [Value]]
 * Rows written as few multi-row statements; existing rows are updated in
 * place (never replaced, which would cascade-delete their children).
 */
function upserts(table: Table, rows: Value[][]): [string, Value[]][] {
	const cols = COLS[table];
	const key = table === 'purchase_lines' ? ['purchase_id', 'position'] : ['id'];
	const set = cols.filter((c) => !key.includes(c)).map((c) => `${c} = excluded.${c}`).join(', ');
	// A picture is up to ~1 MB of data: one per statement keeps each request small.
	const perStatement = table === 'images' ? 1 : Math.floor(MAX_PARAMS / cols.length);
	return chunk(rows, perStatement).map((part) => [
		`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${part.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')} ` +
			`ON CONFLICT (${key.join(', ')}) DO UPDATE SET ${set}`,
		part.flat()
	]);
}

/** statements : [Change] -> [SQL, [Value]] — the SQL a list of changes needs, in a safe order. */
export function statements(changes: readonly Change[]): [string, Value[]][] {
	const puts = new Map<Table, Map<string, Value[]>>();
	const deletes = new Map<Table, Set<string>>();
	const linesOf = new Map<string, string[]>(); // order id -> its line ids
	const purchasesPut: string[] = [];
	let settings: Settings | null = null;

	for (const c of changes) {
		if ('put' in c) {
			if (c.put === 'settings') settings = c.value;
			if (c.put === 'order') linesOf.set(c.value.id, c.value.lines.map((l) => l.id));
			if (c.put === 'purchase') purchasesPut.push(c.value.id);
			for (const [table, row] of rowsOf(c)) {
				const m = puts.get(table) ?? new Map<string, Value[]>();
				// The last put of a record wins, as it would written one by one.
				m.set(table === 'purchase_lines' ? `${row[0]}:${row[1]}` : String(row[0]), row);
				puts.set(table, m);
			}
		} else {
			const table = DELETE_TABLE[c.delete];
			const s = deletes.get(table) ?? new Set<string>();
			s.add(c.id);
			deletes.set(table, s);
		}
	}

	const out: [string, Value[]][] = [];
	// A purchase's lines are rewritten whole.
	for (const ids of chunk(purchasesPut, MAX_PARAMS))
		out.push([`DELETE FROM purchase_lines WHERE purchase_id IN (${ids.map(() => '?').join(', ')})`, ids]);
	for (const table of PUT_ORDER) {
		const rows = puts.get(table);
		if (rows) out.push(...upserts(table, [...rows.values()]));
	}
	// An order's lines are exactly the ones it was put with.
	for (const [orderId, lineIds] of linesOf)
		for (const part of chunk(lineIds, MAX_PARAMS - 1))
			out.push([
				`DELETE FROM order_lines WHERE order_id = ? AND id NOT IN (${part.map(() => '?').join(', ')})`,
				[orderId, ...part]
			]);
	if (settings) out.push(...settingsStatements(settings));
	for (const table of DELETE_ORDER) {
		const ids = deletes.get(table);
		if (!ids) continue;
		for (const part of chunk([...ids], MAX_PARAMS))
			out.push([`DELETE FROM ${table} WHERE id IN (${part.map(() => '?').join(', ')})`, part]);
	}
	return out;
}

function settingsStatements(s: Settings): [string, Value[]][] {
	return [
		[
			'UPDATE settings SET default_price_cents = ?, sheet_price_cents = ?, custom_per_sheet = ?, labor_per_shirt_cents = ?, packaging_per_order_cents = ? WHERE id = 1',
			[s.defaultPrice, s.sheetPrice, s.customPerSheet, s.laborPerShirt, s.packagingPerOrder]
		],
		[
			`INSERT INTO garment_costs (garment, blank_cost_cents) VALUES ${GARMENTS.map(() => '(?, ?)').join(', ')} ON CONFLICT (garment) DO UPDATE SET blank_cost_cents = excluded.blank_cost_cents`,
			GARMENTS.flatMap((g) => [g, s.blankCost[g]])
		],
		[
			`INSERT INTO courier_costs (country, cost_cents) VALUES ${COUNTRIES.map(() => '(?, ?)').join(', ')} ON CONFLICT (country) DO UPDATE SET cost_cents = excluded.cost_cents`,
			COUNTRIES.flatMap((c) => [c, s.courierCost[c]])
		]
	];
}

/**
 * commit : D1 [Change] -> void
 * Writes the changes in one batch. D1 runs a batch as a transaction: if any
 * statement fails, none of them happened.
 */
export async function commit(db: D1Database, changes: readonly Change[]): Promise<void> {
	const sql = statements(changes);
	if (sql.length === 0) return;
	await db.batch(sql.map(([q, params]) => db.prepare(q).bind(...params)));
}
