import { error } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { getOrder } from '$lib/data/orders';
import { orderReadiness } from '$lib/data/stock';
import { designs, orderItemImages, orderItems } from '$lib/data/schema';
import { imageIndex } from '$lib/data/images';
import { economics } from '$lib/data/economics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { db } }) => {
	const id = Number(params.id);
	const order = await getOrder(db, id);
	if (!order) throw error(404, 'Porosia nuk u gjet');

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));
	const images = await imageIndex(db);

	// Versions of the personalised mockups (not the image data).
	const mockups = items.length
		? await db
				.select({ itemId: orderItemImages.itemId, side: orderItemImages.side, v: orderItemImages.updatedAt })
				.from(orderItemImages)
				.where(inArray(orderItemImages.itemId, items.map((i) => i.id)))
		: [];

	const readiness = await orderReadiness(db, id);
	const readyById = new Map(readiness.items.map((r) => [r.itemId, r]));

	return {
		order,
		items: items.map((i) => ({
			...i,
			designName: i.designId ? (designName.get(i.designId) ?? null) : null,
			images: i.designId ? (images.get(i.designId) ?? {}) : {},
			mockups: Object.fromEntries(mockups.filter((m) => m.itemId === i.id).map((m) => [m.side, m.v])) as {
				front?: number;
				back?: number;
			},
			readiness: readyById.get(i.id) ?? { needBlanks: 0, needTransfers: 0, ready: true }
		})),
		ready: readiness.ready,
		econ: economics(order, items)
	};
};
