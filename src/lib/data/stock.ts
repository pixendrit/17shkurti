import { and, eq, inArray } from 'drizzle-orm';
import { blanks, dtfStock, orderItems, orders, stockLog } from './schema';
import { OPEN_STATUSES } from '$lib/constants';
import type { DB } from './types';

export type ItemReadiness = {
	itemId: number;
	needBlanks: number;
	needTransfers: number;
	ready: boolean;
};

export function variantKey(productType: string, color: string, size: string) {
	return `${productType}|||${color}|||${size}`;
}

/** What is missing before this order can be printed. */
export async function orderReadiness(db: DB, orderId: number) {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

	// Stock already taken for this order is not "missing".
	if (order?.stockDeductedAt) {
		return {
			items: items.map((i) => ({ itemId: i.id, needBlanks: 0, needTransfers: 0, ready: true })),
			ready: true
		};
	}

	const allBlanks = await db.select().from(blanks);
	const allDtf = await db.select().from(dtfStock);

	// Track what's left locally, so two items can't both claim the same blank.
	const blankLeft = new Map(
		allBlanks.map((b) => [variantKey(b.productType, b.color, b.size), b.quantity])
	);
	const dtfLeft = new Map(allDtf.map((d) => [d.designId, d.quantity]));

	const result: ItemReadiness[] = [];

	for (const item of items) {
		const bKey = variantKey(item.productType, item.color, item.size);
		const haveBlank = blankLeft.get(bKey) ?? 0;
		const usedBlank = Math.min(haveBlank, item.quantity);
		blankLeft.set(bKey, haveBlank - usedBlank);

		let needTransfers = 0;
		if (item.isCustom) {
			// A personalised print is made for this order alone, not taken from stock.
			needTransfers = item.customPrintReady ? 0 : item.quantity;
		} else if (item.designId) {
			const haveDtf = dtfLeft.get(item.designId) ?? 0;
			const usedDtf = Math.min(haveDtf, item.quantity);
			dtfLeft.set(item.designId, haveDtf - usedDtf);
			needTransfers = item.quantity - usedDtf;
		}

		const needBlanks = item.quantity - usedBlank;
		result.push({
			itemId: item.id,
			needBlanks,
			needTransfers,
			ready: needBlanks === 0 && needTransfers === 0
		});
	}

	return { items: result, ready: result.every((r) => r.ready) };
}

/**
 * Everything to buy or print to clear the open order book. Demand is summed
 * across all open orders first, then stock subtracted once — so one blank
 * covering three orders isn't counted three times.
 */
export async function shoppingList(db: DB) {
	const open = await db.select().from(orders).where(inArray(orders.status, OPEN_STATUSES));
	const ids = open.filter((o) => !o.stockDeductedAt).map((o) => o.id);
	if (ids.length === 0) return { blanks: [], transfers: [], custom: [] };

	const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ids));

	const blankDemand = new Map<string, number>();
	const dtfDemand = new Map<number, number>();
	for (const item of items) {
		const key = variantKey(item.productType, item.color, item.size);
		blankDemand.set(key, (blankDemand.get(key) ?? 0) + item.quantity);
		if (!item.isCustom && item.designId) dtfDemand.set(item.designId, (dtfDemand.get(item.designId) ?? 0) + item.quantity);
	}

	const allBlanks = await db.select().from(blanks);
	const dtfRows = await db.select().from(dtfStock);

	const blankNeeds = [];
	for (const [key, demand] of blankDemand) {
		const [productType, color, size] = key.split('|||');
		const have =
			allBlanks.find((b) => b.productType === productType && b.color === color && b.size === size)
				?.quantity ?? 0;
		if (demand - have > 0) {
			blankNeeds.push({ productType, color, size, demand, have, short: demand - have });
		}
	}

	const transferNeeds = [];
	for (const [designId, demand] of dtfDemand) {
		const row = dtfRows.find((d) => d.designId === designId);
		const have = row?.quantity ?? 0;
		const onOrder = row?.onOrder ?? 0;
		if (demand - have - onOrder > 0) {
			transferNeeds.push({ designId, demand, have, onOrder, short: demand - have - onOrder });
		}
	}

	// Personalised prints still to be printed, one line per order item.
	const code = new Map(open.map((o) => [o.id, o.code]));
	const custom = items
		.filter((i) => i.isCustom && !i.customPrintReady)
		.map((i) => ({ itemId: i.id, orderId: i.orderId, code: code.get(i.orderId) ?? '', quantity: i.quantity }));

	return { blanks: blankNeeds, transfers: transferNeeds, custom };
}

/** Deduct what an order consumes, once, logging every move. */
export async function deductStockForOrder(db: DB, orderId: number) {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
	if (!order) throw new Error('Order not found');
	if (order.stockDeductedAt) return { alreadyDone: true };

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
	const ts = Math.floor(Date.now() / 1000);

	for (const item of items) {
		const [blank] = await db
			.select()
			.from(blanks)
			.where(
				and(
					eq(blanks.productType, item.productType),
					eq(blanks.color, item.color),
					eq(blanks.size, item.size)
				)
			)
			.limit(1);

		if (blank) {
			await db
				.update(blanks)
				.set({ quantity: Math.max(0, blank.quantity - item.quantity) })
				.where(eq(blanks.id, blank.id));
			await db.insert(stockLog).values({
				kind: 'blank',
				refId: blank.id,
				delta: -item.quantity,
				reason: `Përdorur për porosinë ${order.code}`,
				orderId
			});
		}

		// Personalised prints never came out of design stock.
		if (item.designId && !item.isCustom) {
			const [dtf] = await db
				.select()
				.from(dtfStock)
				.where(eq(dtfStock.designId, item.designId))
				.limit(1);
			if (dtf) {
				await db
					.update(dtfStock)
					.set({ quantity: Math.max(0, dtf.quantity - item.quantity) })
					.where(eq(dtfStock.id, dtf.id));
				await db.insert(stockLog).values({
					kind: 'dtf',
					refId: dtf.id,
					delta: -item.quantity,
					reason: `Përdorur për porosinë ${order.code}`,
					orderId
				});
			}
		}
	}

	await db.update(orders).set({ stockDeductedAt: ts, updatedAt: ts }).where(eq(orders.id, orderId));
	return { alreadyDone: false };
}

/** Manual adjustment: restock, correction, breakage. */
export async function adjustStock(
	db: DB,
	kind: 'blank' | 'dtf',
	refId: number,
	delta: number,
	reason: string
) {
	const table = kind === 'blank' ? blanks : dtfStock;
	const [row] = await db.select().from(table).where(eq(table.id, refId)).limit(1);
	if (!row) throw new Error('Stock row not found');

	await db
		.update(table)
		.set({ quantity: Math.max(0, row.quantity + delta) })
		.where(eq(table.id, refId));
	await db.insert(stockLog).values({ kind, refId, delta, reason });
}
