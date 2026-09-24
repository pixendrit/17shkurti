import { desc, eq, like, or, inArray, sql } from 'drizzle-orm';
import { designs, orderItems, orders } from './schema';
import { economics } from './economics';
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

export async function getOrder(db: DB, id: number) {
	const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
	return row ?? null;
}

export type OrderFilters = {
	status?: string;
	q?: string;
	channel?: string;
	kind?: string;
	delivery?: string;
};

export async function listOrders(db: DB, f: OrderFilters = {}) {
	const conditions = [];
	if (f.status && f.status !== 'all') conditions.push(eq(orders.status, f.status));
	if (f.channel) conditions.push(eq(orders.channel, f.channel));
	if (f.kind) conditions.push(eq(orders.kind, f.kind));
	if (f.delivery) conditions.push(eq(orders.deliveryMethod, f.delivery));
	if (f.q) {
		const term = `%${f.q}%`;
		conditions.push(
			or(
				like(orders.customerName, term),
				like(orders.phone, term),
				like(orders.code, term),
				like(orders.city, term),
				like(orders.trackingRef, term)
			)!
		);
	}

	const rows = await db
		.select()
		.from(orders)
		.where(conditions.length ? sql`${sql.join(conditions, sql` and `)}` : undefined)
		.orderBy(desc(orders.createdAt), desc(orders.id));

	if (rows.length === 0) return [];

	// D1 caps bound parameters per query, so fetch items in chunks.
	const items: (typeof orderItems.$inferSelect)[] = [];
	for (let i = 0; i < rows.length; i += 80) {
		const ids = rows.slice(i, i + 80).map((r) => r.id);
		items.push(...(await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))));
	}
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));

	return rows.map((o) => {
		const mine = items.filter((i) => i.orderId === o.id);
		return {
			...o,
			items: mine.map((i) => ({
				...i,
				designName: i.designId ? (designName.get(i.designId) ?? null) : null
			})),
			econ: economics(o, mine)
		};
	});
}
