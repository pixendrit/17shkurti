import { listOrders } from '$lib/server/orders';
import { orderReadiness } from '$lib/server/stock';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const status = url.searchParams.get('status') ?? 'open';
	const q = url.searchParams.get('q') ?? '';

	const all = await listOrders({ status: status === 'open' ? undefined : status, q });
	const filtered =
		status === 'open'
			? all.filter((o) => !['delivered', 'cancelled'].includes(o.status))
			: all;

	// Flag which orders are actually makeable right now.
	const readiness = await Promise.all(
		filtered.map(async (o) => ({ id: o.id, ...(await orderReadiness(o.id)) }))
	);
	const readyMap = new Map(readiness.map((r) => [r.id, r.ready]));

	return {
		orders: filtered.map((o) => ({ ...o, canMake: readyMap.get(o.id) ?? false })),
		status,
		q
	};
};
