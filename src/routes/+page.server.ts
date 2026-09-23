import { listOrders } from '$lib/data/orders';
import { orderReadiness, shoppingList } from '$lib/data/stock';
import { financials } from '$lib/data/stats';
import { designs } from '$lib/data/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {

	const all = await listOrders(db);
	const open = all.filter((o) => !['delivered', 'cancelled'].includes(o.status));

	const readiness = await Promise.all(
		open.map(async (o) => ({ id: o.id, ...(await orderReadiness(db, o.id)) }))
	);
	const readyMap = new Map(readiness.map((r) => [r.id, r.ready]));
	const withReadiness = open.map((o) => ({ ...o, canMake: readyMap.get(o.id) ?? false }));

	const list = await shoppingList(db);
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));
	const stats = await financials(db, 30);

	return {
		newCount: open.filter((o) => o.status === 'new').length,
		openCount: open.length,
		canMake: withReadiness.filter((o) => o.canMake && o.status !== 'ready'),
		blocked: withReadiness.filter((o) => !o.canMake),
		toShip: withReadiness.filter((o) => o.status === 'ready'),
		toBuyCount: list.blanks.reduce((a, b) => a + b.short, 0),
		toPrint: list.transfers.map((t) => ({ ...t, designName: designName.get(t.designId) ?? 'Unknown' })),
		revenue30: stats.revenue,
		profit30: stats.profit,
		outstanding: stats.outstanding
	};
};
