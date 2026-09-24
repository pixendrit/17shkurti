import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getOrder, orderCost, orderTotal } from '$lib/data/orders';
import { orderReadiness } from '$lib/data/stock';
import { designs, orderItems } from '$lib/data/schema';
import { imageIndex } from '$lib/data/images';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { db } }) => {
	const id = Number(params.id);

	const order = await getOrder(db, id);
	if (!order) throw error(404, 'Porosia nuk u gjet');

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));
	const images = await imageIndex(db);

	const readiness = await orderReadiness(db, id);
	const readyById = new Map(readiness.items.map((r) => [r.itemId, r]));
	const { subtotal, total } = orderTotal(items, order.shippingFee, order.discount);

	return {
		order,
		items: items.map((i) => ({
			...i,
			designName: i.designId ? (designName.get(i.designId) ?? null) : null,
			images: i.designId ? (images.get(i.designId) ?? {}) : {},
			readiness: readyById.get(i.id) ?? { needBlanks: 0, needTransfers: 0, ready: true }
		})),
		ready: readiness.ready,
		subtotal,
		total,
		cost: orderCost(items)
	};
};
