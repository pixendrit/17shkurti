import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '$lib/data/types';
import {
	blanks,
	CHANNELS,
	COUNTRIES,
	DELIVERY_METHODS,
	designs,
	dtfStock,
	EXPENSE_CATEGORIES,
	expenses,
	ORDER_KINDS,
	ORDER_STATUSES,
	orderItemImages,
	orderItems,
	orders,
	stockLog
} from '$lib/data/schema';
import { adjustStock, deductStockForOrder, orderReadiness } from '$lib/data/stock';
import { saveSettings, type CostSettings } from '$lib/data/settings';

/** Run a unit of work against the database. */
function run<T>(db: DB, fn: (d: DB) => Promise<T>): Promise<T> {
	return fn(db);
}

export type { NewOrderInput } from './create-order';

const now = () => Math.floor(Date.now() / 1000);

/** Statuses at which the shirts physically exist, so their stock must be taken. */
const MADE = ['ready', 'shipped', 'delivered'];

/**
 * Move an order along. Reaching ready/shipped/delivered takes its stock if
 * "made" was skipped, so inventory can't drift out of step with reality.
 */
export async function setOrderStatus(db: DB, orderId: number, status: string) {
	if (!(ORDER_STATUSES as readonly string[]).includes(status)) return 'Status i panjohur.';
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
	if (!order) return 'Porosia nuk u gjet.';

	if (MADE.includes(status) && !order.stockDeductedAt) await deductStockForOrder(db, orderId);

	const ts = now();
	// Stepping back before hand-over clears it; delivered/returned keep when it left.
	const beforeHandover = ['new', 'in_production', 'ready', 'cancelled'].includes(status);
	await db
		.update(orders)
		.set({
			status,
			updatedAt: ts,
			shippedAt: status === 'shipped' ? (order.shippedAt ?? ts) : beforeHandover ? null : order.shippedAt,
			deliveredAt: status === 'delivered' ? (order.deliveredAt ?? ts) : null
		})
		.where(eq(orders.id, orderId));
	return null;
}

/** The courier picked up several parcels at once. */
export async function shipOrders(db: DB, ids: number[]) {
	for (const id of ids) await setOrderStatus(db, id, 'shipped');
}

export async function deliverOrders(db: DB, ids: number[]) {
	for (const id of ids) await setOrderStatus(db, id, 'delivered');
}

/** The courier paid out (or the customer paid in hand) for these orders. */
export async function settleOrders(db: DB, ids: number[]) {
	const ts = now();
	for (const id of ids) {
		await db.update(orders).set({ paymentStatus: 'paid', paidAt: ts, updatedAt: ts }).where(eq(orders.id, id));
	}
}

export async function setPaymentStatus(db: DB, orderId: number, paymentStatus: string) {
	const ts = now();
	const paid = paymentStatus === 'paid';
	await db
		.update(orders)
		.set({ paymentStatus: paid ? 'paid' : 'unpaid', paidAt: paid ? ts : null, updatedAt: ts })
		.where(eq(orders.id, orderId));
}

export type OrderEdit = {
	customerName: string;
	phone: string;
	address: string;
	city: string;
	country: string;
	channel: string;
	kind: string;
	deliveryMethod: string;
	paymentMethod: string;
	shippingFee: number;
	shippingCost: number;
	discount: number;
	trackingRef: string;
	notes: string;
};

/** Fix the details of an order. Items and stock are left alone. */
export async function editOrder(db: DB, orderId: number, e: OrderEdit): Promise<string | null> {
	if (!e.customerName?.trim()) return 'Emri i klientit është i detyrueshëm.';
	if (!e.phone?.trim()) return 'Numri i telefonit është i detyrueshëm.';
	const pick = <T extends string>(list: readonly T[], v: string, fb: T) =>
		(list as readonly string[]).includes(v) ? (v as T) : fb;
	await db
		.update(orders)
		.set({
			customerName: e.customerName.trim(),
			phone: e.phone.trim(),
			address: e.address?.trim() || null,
			city: e.city?.trim() || null,
			country: pick(COUNTRIES, e.country, 'XK'),
			channel: pick(CHANNELS, e.channel, 'other'),
			kind: pick(ORDER_KINDS, e.kind, 'sale'),
			deliveryMethod: pick(DELIVERY_METHODS, e.deliveryMethod, 'post'),
			paymentMethod: e.paymentMethod,
			shippingFee: Math.max(0, Number(e.shippingFee) || 0),
			shippingCost: Math.max(0, Number(e.shippingCost) || 0),
			discount: Math.max(0, Number(e.discount) || 0),
			trackingRef: e.trackingRef?.trim() || null,
			notes: e.notes?.trim() || null,
			updatedAt: now()
		})
		.where(eq(orders.id, orderId));
	return null;
}

/** The personalised DTF for this item has arrived from the printer. */
export async function setCustomPrintReady(db: DB, itemId: number, ready: boolean) {
	await db.update(orderItems).set({ customPrintReady: ready }).where(eq(orderItems.id, itemId));
}

/** Take the blanks and transfers out of stock. Refuses when short. */
export async function markAsMade(db: DB, orderId: number): Promise<string | null> {
	if (!(await orderReadiness(db, orderId)).ready) {
		return 'Ende s\'ka stok të mjaftueshëm për këtë porosi.';
	}
	await run(db, async (d) => {
		await deductStockForOrder(d, orderId);
		await d
			.update(orders)
			.set({ status: 'ready', updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(orders.id, orderId));
	});
	return null;
}

export async function deleteOrder(db: DB, orderId: number) {
	// Delete children explicitly rather than relying on the foreign-key pragma.
	const items = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
	if (items.length) {
		await db.delete(orderItemImages).where(inArray(orderItemImages.itemId, items.map((i) => i.id)));
	}
	await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
	await db.update(stockLog).set({ orderId: null }).where(eq(stockLog.orderId, orderId));
	await db.delete(orders).where(eq(orders.id, orderId));
}

export async function changeStock(db: DB, 
	kind: 'blank' | 'dtf',
	refId: number,
	delta: number,
	reason = 'Rregullim manual'
) {
	await run(db, (db) => adjustStock(db, kind, refId, delta, reason));
}

export async function addBlank(db: DB, input: {
	productType: string;
	color: string;
	size: string;
	quantity: number;
	unitCost: number;
}): Promise<string | null> {
	const existing = (await db.select().from(blanks)).find(
		(b) =>
			b.productType === input.productType && b.color === input.color && b.size === input.size
	);
	if (existing) return 'Kjo veshje pa print ekziston tashmë.';
	await run(db, (d) => d.insert(blanks).values(input));
	return null;
}

/**
 * Set the transfer count and cost for a design.
 *
 * Every design gets a stock row at zero the moment it is created, so this is
 * almost always an update rather than an insert — treat it as an upsert so the
 * form never dead-ends on "already exists".
 */
export async function setDtfStock(db: DB, input: {
	designId: number;
	quantity: number;
	unitCost: number;
}): Promise<string | null> {
	const [existing] = await db
		.select()
		.from(dtfStock)
		.where(eq(dtfStock.designId, input.designId))
		.limit(1);

	if (existing) {
		const delta = input.quantity - existing.quantity;
		await run(db, async (d) => {
			await d
				.update(dtfStock)
				.set({ quantity: input.quantity, unitCost: input.unitCost })
				.where(eq(dtfStock.id, existing.id));
			// Keep the audit trail honest about the correction.
			if (delta !== 0) {
				await d.insert(stockLog).values({
					kind: 'dtf',
					refId: existing.id,
					delta,
					reason: 'Stoku u vendos manualisht'
				});
			}
		});
		return null;
	}

	await run(db, (d) => d.insert(dtfStock).values(input));
	return null;
}

export async function setOnOrder(db: DB, id: number, onOrder: number) {
	await run(db, (db) =>
		db.update(dtfStock).set({ onOrder: Math.max(0, onOrder) }).where(eq(dtfStock.id, id))
	);
}

/** Transfers arrived: move them from on-order into real stock. */
export async function receiveDtf(db: DB, id: number) {
	const [row] = await db.select().from(dtfStock).where(eq(dtfStock.id, id)).limit(1);
	if (!row || row.onOrder <= 0) return;
	await run(db, async (d) => {
		await adjustStock(d, 'dtf', id, row.onOrder, 'Printimet u morën nga printeri');
		await d.update(dtfStock).set({ onOrder: 0 }).where(eq(dtfStock.id, id));
	});
}

/** Returns the new design's id, so its pictures can be uploaded straight after. */
export async function createDesign(
	db: DB,
	name: string,
	notes: string
): Promise<{ error: string } | { id: number }> {
	if (!name.trim()) return { error: 'Jepini dizajnit një emër.' };
	const id = await run(db, async (db) => {
		const [design] = await db
			.insert(designs)
			.values({ name: name.trim(), notes: notes.trim() || null })
			.returning();
		// Start tracking its transfer stock straight away, at zero.
		await db.insert(dtfStock).values({ designId: design.id, quantity: 0 });
		return design.id;
	});
	return { id };
}

export async function renameDesign(db: DB, id: number, name: string): Promise<string | null> {
	if (!name.trim()) return 'Jepini dizajnit një emër.';
	await db.update(designs).set({ name: name.trim() }).where(eq(designs.id, id));
	return null;
}

export async function toggleArchive(db: DB, id: number) {
	const [current] = await db.select().from(designs).where(eq(designs.id, id)).limit(1);
	if (!current) return;
	await run(db, (d) => d.update(designs).set({ archived: !current.archived }).where(eq(designs.id, id)));
}

/** Shirts per DTF sheet for a design: sets its DTF cost on future orders. */
export async function setShirtsPerSheet(db: DB, designId: number, n: number): Promise<string | null> {
	if (!Number.isInteger(n) || n < 1 || n > 100) return 'Vendosni një numër nga 1 deri në 100.';
	await db.update(designs).set({ shirtsPerSheet: n }).where(eq(designs.id, designId));
	return null;
}

export async function saveCostSettings(db: DB, next: CostSettings): Promise<string | null> {
	const nums = [
		next.defaultPrice,
		next.dtfSheetPrice,
		next.laborPerShirt,
		next.packagingPerOrder,
		...Object.values(next.blankCost),
		...Object.values(next.postCost)
	];
	if (nums.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
		return 'Çmimet duhet të jenë numra jo negativë.';
	}
	if (!(next.customShirtsPerSheet >= 1)) return 'Printime për fletë duhet të jetë të paktën 1.';
	await saveSettings(db, next);
	return null;
}

// ---- Expenses ---------------------------------------------------------------

export type ExpenseInput = {
	date: number;
	category: string;
	description?: string;
	quantity?: number | null;
	amount: number;
};

export async function addExpense(db: DB, e: ExpenseInput): Promise<string | null> {
	if (!(EXPENSE_CATEGORIES as readonly string[]).includes(e.category)) return 'Kategori e panjohur.';
	if (!(e.amount > 0)) return 'Vendosni shumën e paguar.';
	await db.insert(expenses).values({
		date: e.date || now(),
		category: e.category,
		description: e.description?.trim() || null,
		quantity: e.quantity ?? null,
		amount: e.amount
	});
	return null;
}

export async function deleteExpense(db: DB, id: number) {
	await db.delete(expenses).where(eq(expenses.id, id));
}

/**
 * Bought blank shirts: log what was paid and put them on the shelf. The
 * blank's cost becomes the weighted average of what's in stock and what just
 * arrived, so future orders cost what the shirts actually cost.
 */
export async function buyBlanks(
	db: DB,
	p: { date: number; productType: string; color: string; sizes: Record<string, number>; unitPrice: number; note?: string }
): Promise<string | null> {
	const lines = Object.entries(p.sizes).filter(([, q]) => Number.isInteger(q) && q > 0);
	const total = lines.reduce((a, [, q]) => a + q, 0);
	if (total === 0) return 'Vendosni sa copë keni blerë.';
	if (!(p.unitPrice > 0)) return 'Vendosni çmimin për copë.';

	await db.insert(expenses).values({
		date: p.date || now(),
		category: 'blanks',
		description: p.note?.trim() || `${p.productType} · ${p.color} · ${lines.map(([s, q]) => `${q}×${s}`).join(', ')}`,
		quantity: total,
		amount: Math.round(total * p.unitPrice * 100) / 100
	});

	for (const [size, qty] of lines) {
		const [row] = await db
			.select()
			.from(blanks)
			.where(and(eq(blanks.productType, p.productType), eq(blanks.color, p.color), eq(blanks.size, size)))
			.limit(1);
		if (row) {
			const have = Math.max(0, row.quantity);
			const avg = have + qty > 0 ? (have * row.unitCost + qty * p.unitPrice) / (have + qty) : p.unitPrice;
			await db.update(blanks).set({ unitCost: Math.round(avg * 100) / 100 }).where(eq(blanks.id, row.id));
			await adjustStock(db, 'blank', row.id, qty, 'Blerje');
		} else {
			const [created] = await db
				.insert(blanks)
				.values({ productType: p.productType, color: p.color, size, quantity: 0, unitCost: p.unitPrice })
				.returning({ id: blanks.id });
			await adjustStock(db, 'blank', created.id, qty, 'Blerje');
		}
	}
	return null;
}

/** Bought DTF sheets: log the cost and add the prints they carried to stock. */
export async function buyDtf(
	db: DB,
	p: { date: number; sheets: number; pricePerSheet: number; prints: Record<string, number>; note?: string }
): Promise<string | null> {
	if (!(p.sheets > 0)) return 'Vendosni sa fletë keni blerë.';
	if (!(p.pricePerSheet > 0)) return 'Vendosni çmimin për fletë.';

	const lines = Object.entries(p.prints)
		.map(([id, q]) => [Number(id), q] as const)
		.filter(([, q]) => Number.isInteger(q) && q > 0);
	const names = new Map((await db.select().from(designs)).map((d) => [d.id, d.name]));

	await db.insert(expenses).values({
		date: p.date || now(),
		category: 'dtf',
		description:
			p.note?.trim() ||
			(lines.length ? lines.map(([id, q]) => `${q}× ${names.get(id) ?? '?'}`).join(', ') : 'Fletë DTF'),
		quantity: p.sheets,
		amount: Math.round(p.sheets * p.pricePerSheet * 100) / 100
	});

	for (const [designId, qty] of lines) {
		let [row] = await db.select().from(dtfStock).where(eq(dtfStock.designId, designId)).limit(1);
		if (!row) [row] = await db.insert(dtfStock).values({ designId, quantity: 0 }).returning();
		await adjustStock(db, 'dtf', row.id, qty, 'Blerje DTF');
	}
	return null;
}

// ---- Demo data --------------------------------------------------------------

/** Remove every sample order and expense; real records are untouched. */
export async function clearDemoData(db: DB) {
	const demo = await db.select({ id: orders.id }).from(orders).where(eq(orders.isDemo, true));
	for (const o of demo) await deleteOrder(db, o.id);
	await db.delete(expenses).where(eq(expenses.isDemo, true));
	return { orders: demo.length };
}
