import { listOrders } from '$lib/data/orders';
import { orderReadiness, shoppingList } from '$lib/data/stock';
import { financials } from '$lib/data/stats';
import { designs } from '$lib/data/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {
	const all = await listOrders(db);
	const toMake = all.filter((o) => ['new', 'in_production'].includes(o.status));

	const canMake = new Map<number, boolean>();
	for (const o of toMake) canMake.set(o.id, o.stockDeductedAt ? true : (await orderReadiness(db, o.id)).ready);

	const list = await shoppingList(db);
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));
	const stats = await financials(db, 30);

	const card = (o: (typeof all)[number]) => ({
		id: o.id,
		code: o.code,
		customerName: o.customerName,
		status: o.status,
		deliveryMethod: o.deliveryMethod,
		kind: o.kind,
		units: o.econ.units,
		revenue: o.econ.revenue
	});

	return {
		openCount: all.filter((o) => !['delivered', 'cancelled', 'returned'].includes(o.status)).length,
		newCount: all.filter((o) => o.status === 'new').length,
		canMake: toMake.filter((o) => canMake.get(o.id)).map(card),
		blocked: toMake.filter((o) => !canMake.get(o.id)).map(card),
		ready: all.filter((o) => o.status === 'ready').map(card),
		shipments: {
			pickup: all.filter((o) => o.deliveryMethod === 'post' && o.status === 'ready').length,
			courier: all.filter((o) => o.deliveryMethod === 'post' && o.status === 'shipped').length,
			unpaid: all
				.filter((o) => o.kind === 'sale' && o.status === 'delivered' && o.paymentStatus !== 'paid')
				.reduce((a, o) => a + o.econ.revenue, 0)
		},
		toBuyCount: list.blanks.reduce((a, b) => a + b.short, 0),
		toPrint: list.transfers.map((t) => ({ ...t, designName: designName.get(t.designId) ?? 'I panjohur' })),
		customPending: list.custom.length,
		revenue30: stats.revenue,
		net30: stats.net,
		outstanding: stats.outstanding
	};
};
