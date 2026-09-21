import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { blanks, dtfStock, orderItems, orders, stockLog } from './db/schema';
import { OPEN_STATUSES } from '$lib/constants';

export type ItemReadiness = {
	itemId: number;
	needBlanks: number;
	needTransfers: number;
	ready: boolean;
};

/**
 * Work out, for one order, what is missing before it can be printed.
 *
 * Stock already deducted for an order counts as satisfied — otherwise an order
 * that has been made would keep showing up as "missing stock".
 */
export async function orderReadiness(orderId: number) {
	const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

	if (order?.stockDeductedAt) {
		return {
			items: items.map((i) => ({
				itemId: i.id,
				needBlanks: 0,
				needTransfers: 0,
				ready: true
			})),
			ready: true
		};
	}

	const allBlanks = await db.select().from(blanks);
	const allDtf = await db.select().from(dtfStock);

	// Track remaining stock locally so two items needing the same blank don't
	// both think it is available.
	const blankLeft = new Map(allBlanks.map((b) => [variantKey(b.productType, b.color, b.size), b.quantity]));
	const dtfLeft = new Map(allDtf.map((d) => [d.designId, d.quantity]));

	const result: ItemReadiness[] = [];

	for (const item of items) {
		const bKey = variantKey(item.productType, item.color, item.size);
		const haveBlank = blankLeft.get(bKey) ?? 0;
		const usedBlank = Math.min(haveBlank, item.quantity);
		blankLeft.set(bKey, haveBlank - usedBlank);

		let usedDtf = item.quantity;
		if (item.designId) {
			const haveDtf = dtfLeft.get(item.designId) ?? 0;
			usedDtf = Math.min(haveDtf, item.quantity);
			dtfLeft.set(item.designId, haveDtf - usedDtf);
		}

		const needBlanks = item.quantity - usedBlank;
		const needTransfers = item.designId ? item.quantity - usedDtf : 0;

		result.push({
			itemId: item.id,
			needBlanks,
			needTransfers,
			ready: needBlanks === 0 && needTransfers === 0
		});
	}

	return { items: result, ready: result.every((r) => r.ready) };
}

export function variantKey(productType: string, color: string, size: string) {
	return `${productType}|||${color}|||${size}`;
}

/**
 * Everything that has to be bought or printed to clear the open order book.
 *
 * Demand is summed across all open orders first, then existing stock is
 * subtracted once — so a blank that covers three orders isn't counted
 * three times.
 */
export async function shoppingList() {
	const open = await db.select().from(orders).where(inArray(orders.status, OPEN_STATUSES));
	const openUndeducted = open.filter((o) => !o.stockDeductedAt);
	const ids = openUndeducted.map((o) => o.id);

	if (ids.length === 0) return { blanks: [], transfers: [] };

	const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ids));

	const blankDemand = new Map<string, number>();
	const dtfDemand = new Map<number, number>();

	for (const item of items) {
		const key = variantKey(item.productType, item.color, item.size);
		blankDemand.set(key, (blankDemand.get(key) ?? 0) + item.quantity);
		if (item.designId) {
			dtfDemand.set(item.designId, (dtfDemand.get(item.designId) ?? 0) + item.quantity);
		}
	}

	const allBlanks = await db.select().from(blanks);
	const dtfRows = await db.select().from(dtfStock);

	const blankNeeds = [];
	for (const [key, demand] of blankDemand) {
		const [productType, color, size] = key.split('|||');
		const have = allBlanks.find(
			(b) => b.productType === productType && b.color === color && b.size === size
		);
		const short = demand - (have?.quantity ?? 0);
		if (short > 0) {
			blankNeeds.push({ productType, color, size, demand, have: have?.quantity ?? 0, short });
		}
	}

	const transferNeeds = [];
	for (const [designId, demand] of dtfDemand) {
		const row = dtfRows.find((d) => d.designId === designId);
		const have = row?.quantity ?? 0;
		const onOrder = row?.onOrder ?? 0;
		const short = demand - have - onOrder;
		if (short > 0) {
			transferNeeds.push({ designId, demand, have, onOrder, short });
		}
	}

	return { blanks: blankNeeds, transfers: transferNeeds };
}

/** Deduct the blanks and transfers an order consumes, once, and log every move. */
export async function deductStockForOrder(orderId: number) {
	const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
	if (!order) throw new Error('Order not found');
	if (order.stockDeductedAt) return { alreadyDone: true };

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
	const ts = Math.floor(Date.now() / 1000);

	for (const item of items) {
		const blank = await db.query.blanks.findFirst({
			where: and(
				eq(blanks.productType, item.productType),
				eq(blanks.color, item.color),
				eq(blanks.size, item.size)
			)
		});
		if (blank) {
			await db
				.update(blanks)
				.set({ quantity: Math.max(0, blank.quantity - item.quantity) })
				.where(eq(blanks.id, blank.id));
			await db.insert(stockLog).values({
				kind: 'blank',
				refId: blank.id,
				delta: -item.quantity,
				reason: `Used for order ${order.code}`,
				orderId
			});
		}

		if (item.designId) {
			const dtf = await db.query.dtfStock.findFirst({
				where: eq(dtfStock.designId, item.designId)
			});
			if (dtf) {
				await db
					.update(dtfStock)
					.set({ quantity: Math.max(0, dtf.quantity - item.quantity) })
					.where(eq(dtfStock.id, dtf.id));
				await db.insert(stockLog).values({
					kind: 'dtf',
					refId: dtf.id,
					delta: -item.quantity,
					reason: `Used for order ${order.code}`,
					orderId
				});
			}
		}
	}

	await db.update(orders).set({ stockDeductedAt: ts, updatedAt: ts }).where(eq(orders.id, orderId));
	return { alreadyDone: false };
}

/** Manual stock adjustment (restock, correction, breakage). */
export async function adjustStock(
	kind: 'blank' | 'dtf',
	refId: number,
	delta: number,
	reason: string
) {
	const table = kind === 'blank' ? blanks : dtfStock;
	const row =
		kind === 'blank'
			? await db.query.blanks.findFirst({ where: eq(blanks.id, refId) })
			: await db.query.dtfStock.findFirst({ where: eq(dtfStock.id, refId) });
	if (!row) throw new Error('Stock row not found');

	await db
		.update(table)
		.set({ quantity: Math.max(0, row.quantity + delta) })
		.where(eq(table.id, refId));
	await db.insert(stockLog).values({ kind, refId, delta, reason });
}
