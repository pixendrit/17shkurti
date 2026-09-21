import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { designs, orderItems, orders } from '$lib/server/db/schema';
import { orderCost, orderTotal } from '$lib/server/orders';
import { deductStockForOrder, orderReadiness } from '$lib/server/stock';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
	if (!order) throw error(404, 'Order not found');

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));

	const readiness = await orderReadiness(id);
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

export const actions: Actions = {
	status: async ({ request, params }) => {
		const f = await request.formData();
		const status = String(f.get('status') ?? '');
		const ts = Math.floor(Date.now() / 1000);

		await db
			.update(orders)
			.set({ status, updatedAt: ts, deliveredAt: status === 'delivered' ? ts : null })
			.where(eq(orders.id, Number(params.id)));

		return { ok: true };
	},

	payment: async ({ request, params }) => {
		const f = await request.formData();
		await db
			.update(orders)
			.set({
				paymentStatus: String(f.get('paymentStatus') ?? 'unpaid'),
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.where(eq(orders.id, Number(params.id)));
		return { ok: true };
	},

	/** Mark as made: take the blanks and transfers out of stock, once. */
	deduct: async ({ params }) => {
		const id = Number(params.id);
		const readiness = await orderReadiness(id);
		if (!readiness.ready) {
			return fail(400, { error: 'Not enough stock to make this order yet.' });
		}
		await deductStockForOrder(id);
		await db
			.update(orders)
			.set({ status: 'ready', updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(orders.id, id));
		return { ok: true };
	},

	delete: async ({ params }) => {
		await db.delete(orders).where(eq(orders.id, Number(params.id)));
		throw redirect(303, '/orders');
	}
};
