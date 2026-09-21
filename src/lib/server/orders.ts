import { desc, eq, like, or, sql, inArray } from 'drizzle-orm';
import { db } from './db';
import { designs, orderItems, orders } from './db/schema';

/** Next sequential order code, e.g. HS-0042. */
export async function nextOrderCode(): Promise<string> {
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(orders);
	let n = (row?.n ?? 0) + 1;
	// Codes are unique in the DB; skip past any that already exist.
	for (;;) {
		const code = `HS-${String(n).padStart(4, '0')}`;
		const clash = await db.query.orders.findFirst({ where: eq(orders.code, code) });
		if (!clash) return code;
		n += 1;
	}
}

export function orderTotal(
	items: { quantity: number; unitPrice: number }[],
	shippingFee = 0,
	discount = 0
) {
	const sub = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
	return { subtotal: sub, total: sub + shippingFee - discount };
}

export function orderCost(items: { quantity: number; unitCost: number }[]) {
	return items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
}

export async function listOrders(opts: { status?: string; q?: string } = {}) {
	const where = [];
	if (opts.status && opts.status !== 'all') where.push(eq(orders.status, opts.status));
	if (opts.q) {
		const term = `%${opts.q}%`;
		where.push(
			or(like(orders.customerName, term), like(orders.phone, term), like(orders.code, term))!
		);
	}

	const rows = await db
		.select()
		.from(orders)
		.where(where.length ? sql`${sql.join(where, sql` and `)}` : undefined)
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
			items: mine.map((i) => ({ ...i, designName: i.designId ? designName.get(i.designId) : null })),
			units: mine.reduce((a, i) => a + i.quantity, 0),
			subtotal,
			total,
			cost: orderCost(mine)
		};
	});
}
