import { listOrders } from '$lib/data/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {
	const all = await listOrders(db);
	const row = (o: (typeof all)[number]) => ({
		id: o.id,
		code: o.code,
		customerName: o.customerName,
		city: o.city,
		country: o.country,
		kind: o.kind,
		trackingRef: o.trackingRef,
		units: o.econ.units,
		revenue: o.econ.revenue,
		since: o.deliveredAt ?? o.shippedAt ?? o.updatedAt
	});

	return {
		awaitingPickup: all.filter((o) => o.deliveryMethod === 'post' && o.status === 'ready').map(row),
		withCourier: all.filter((o) => o.deliveryMethod === 'post' && o.status === 'shipped').map(row),
		toHandOver: all.filter((o) => o.deliveryMethod === 'manual' && ['ready', 'shipped'].includes(o.status)).map(row),
		unpaid: all
			.filter((o) => o.kind === 'sale' && o.status === 'delivered' && o.paymentStatus !== 'paid')
			.map(row)
	};
};
