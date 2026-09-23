import { listOrders } from '$lib/data/orders';
import { orderReadiness } from '$lib/data/stock';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { db } }) => {
	const status = url.searchParams.get('status') ?? 'open';
	const q = url.searchParams.get('q') ?? '';

	const all = await listOrders(db, { status: status === 'open' ? undefined : status, q });
	const filtered =
		status === 'open' ? all.filter((o) => !['delivered', 'cancelled'].includes(o.status)) : all;

	const readiness = await Promise.all(
		filtered.map(async (o) => ({ id: o.id, ...(await orderReadiness(db, o.id)) }))
	);
	const readyMap = new Map(readiness.map((r) => [r.id, r.ready]));

	return {
		orders: filtered.map((o) => ({ ...o, canMake: readyMap.get(o.id) ?? false })),
		status,
		q
	};
};
