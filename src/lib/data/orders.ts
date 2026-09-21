import { desc, eq, like, or, inArray, sql } from 'drizzle-orm';
import { designs, orderItems, orders } from './schema';
import type { DB } from './types';

export async function nextOrderCode(db: DB): Promise<string> {
	const rows = await db.select({ id: orders.id }).from(orders);
	let n = rows.length + 1;
	const taken = new Set(
		(await db.select({ code: orders.code }).from(orders)).map((r) => r.code)
	);
	for (;;) {
		const code = `HS-${String(n).padStart(4, '0')}`;
		if (!taken.has(code)) return code;
		n += 1;
	}
}

export function orderTotal(
	items: { quantity: number; unitPrice: number }[],
	shippingFee = 0,
	discount = 0
) {
	const subtotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
	return { subtotal, total: subtotal + shippingFee - discount };
}

export function orderCost(items: { quantity: number; unitCost: number }[]) {
	return items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
}

export async function getOrder(db: DB, id: number) {
	const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
	return row ?? null;
}

export async function listOrders(db: DB, opts: { status?: string; q?: string } = {}) {
	const conditions = [];
	if (opts.status && opts.status !== 'all') conditions.push(eq(orders.status, opts.status));
	if (opts.q) {
		const term = `%${opts.q}%`;
		conditions.push(
			or(like(orders.customerName, term), like(orders.phone, term), like(orders.code, term))!
		);
	}

	const rows = await db
		.select()
		.from(orders)
		.where(conditions.length ? sql`${sql.join(conditions, sql` and `)}` : undefined)
		.orderBy(desc(orders.createdAt));

	if (rows.length === 0) return [];

	const items = await db
		.select()
		.from(orderItems)
		.where(inArray(orderItems.orderId, rows.map((r) => r.id)));
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));

	return rows.map((o) => {
		const mine = items.filter((i) => i.orderId === o.id);
		const { subtotal, total } = orderTotal(mine, o.shippingFee, o.discount);
		return {
			...o,
			items: mine.map((i) => ({
				...i,
				designName: i.designId ? (designName.get(i.designId) ?? null) : null
			})),
			units: mine.reduce((a, i) => a + i.quantity, 0),
			subtotal,
			total,
			cost: orderCost(mine)
		};
	});
}
