import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/client/db';
import { getOrder, orderCost, orderTotal } from '$lib/data/orders';
import { orderReadiness } from '$lib/data/stock';
import { designs, orderItems } from '$lib/data/schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const db = await getDb();
	const id = Number(params.id);

	const order = await getOrder(db, id);
	if (!order) throw error(404, 'Order not found');

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));

	const readiness = await orderReadiness(db, id);
	const readyById = new Map(readiness.items.map((r) => [r.itemId, r]));
	const { subtotal, total } = orderTotal(items, order.shippingFee, order.discount);

	return {
		order,
		items: items.map((i) => ({
			...i,
			designName: i.designId ? (designName.get(i.designId) ?? null) : null,
			readiness: readyById.get(i.id) ?? { needBlanks: 0, needTransfers: 0, ready: true }
		})),
		ready: readiness.ready,
		subtotal,
		total,
		cost: orderCost(items)
	};
};
