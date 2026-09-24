import { designs, orderItems, orders } from './schema';
import { orderCost, orderTotal } from './orders';
import type { DB } from './types';

/** Orders that never happened shouldn't drag the numbers around. */
const COUNTS = (status: string) => status !== 'cancelled';

export type Period = 30 | 90 | 365 | 0; // 0 = all time

export async function financials(db: DB, days: Period = 30) {
	const all = await db.select().from(orders);
	const items = await db.select().from(orderItems);
	const allDesigns = await db.select().from(designs);

	const itemsByOrder = new Map<number, typeof items>();
	for (const i of items) {
		const list = itemsByOrder.get(i.orderId) ?? [];
		list.push(i);
		itemsByOrder.set(i.orderId, list);
	}

	const cutoff = days === 0 ? 0 : Math.floor(Date.now() / 1000) - days * 86400;
	const live = all.filter((o) => COUNTS(o.status));
	const inRange = live.filter((o) => o.createdAt >= cutoff);

	const enrich = (o: (typeof all)[number]) => {
		const mine = itemsByOrder.get(o.id) ?? [];
		const { total } = orderTotal(mine, o.shippingFee, o.discount);
		return { order: o, total, cost: orderCost(mine), units: mine.reduce((a, i) => a + i.quantity, 0) };
	};

	const rows = inRange.map(enrich);

	const revenue = rows.reduce((a, r) => a + r.total, 0);
	const cost = rows.reduce((a, r) => a + r.cost, 0);
	const units = rows.reduce((a, r) => a + r.units, 0);

	// Money promised vs money actually collected — the COD gap matters here.
	const collected = rows.filter((r) => r.order.paymentStatus === 'paid').reduce((a, r) => a + r.total, 0);

	// Revenue per month, oldest first.
	const byMonth = new Map<string, { revenue: number; profit: number; orders: number }>();
	for (const r of rows) {
		const d = new Date(r.order.createdAt * 1000);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const cur = byMonth.get(key) ?? { revenue: 0, profit: 0, orders: 0 };
		cur.revenue += r.total;
		cur.profit += r.total - r.cost;
		cur.orders += 1;
		byMonth.set(key, cur);
	}

	const byChannel = new Map<string, { revenue: number; orders: number }>();
	for (const r of rows) {
		const cur = byChannel.get(r.order.channel) ?? { revenue: 0, orders: 0 };
		cur.revenue += r.total;
		cur.orders += 1;
		byChannel.set(r.order.channel, cur);
	}

	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));
	const byDesign = new Map<string, { units: number; revenue: number }>();
	for (const r of rows) {
		for (const i of itemsByOrder.get(r.order.id) ?? []) {
			const name = i.designId ? (designName.get(i.designId) ?? 'I panjohur') : 'Pa print';
			const cur = byDesign.get(name) ?? { units: 0, revenue: 0 };
			cur.units += i.quantity;
			cur.revenue += i.quantity * i.unitPrice;
			byDesign.set(name, cur);
		}
	}

	// Money owed on everything delivered but not yet paid.
	const outstanding = live
		.filter((o) => o.paymentStatus === 'unpaid' && o.status !== 'cancelled')
		.map(enrich)
		.reduce((a, r) => a + r.total, 0);

	return {
		revenue,
		cost,
		profit: revenue - cost,
		margin: revenue > 0 ? (revenue - cost) / revenue : 0,
		orderCount: rows.length,
		units,
		avgOrder: rows.length > 0 ? revenue / rows.length : 0,
		collected,
		outstanding,
		byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
		byChannel: [...byChannel.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([channel, v]) => ({ channel, ...v })),
		byDesign: [...byDesign.entries()].sort((a, b) => b[1].units - a[1].units).map(([name, v]) => ({ name, ...v }))
	};
}
