import { and, gte } from 'drizzle-orm';
import { designs, expenses, orderItems, orders } from './schema';
import { economics, type Economics } from './economics';
import type { DB } from './types';

export type Period = 30 | 90 | 365 | 0; // 0 = all time

type Bucket = { orders: number; units: number; revenue: number; profit: number };
const bucket = (): Bucket => ({ orders: 0, units: 0, revenue: 0, profit: 0 });

function add(map: Map<string, Bucket>, key: string, e: Economics) {
	const b = map.get(key) ?? bucket();
	b.orders += 1;
	b.units += e.units;
	b.revenue += e.revenue;
	b.profit += e.profit;
	map.set(key, b);
}

const sorted = (map: Map<string, Bucket>) =>
	[...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.revenue - a.revenue || b.units - a.units);

export async function financials(db: DB, days: Period = 30) {
	const cutoff = days === 0 ? 0 : Math.floor(Date.now() / 1000) - days * 86400;

	const all = await db.select().from(orders).where(gte(orders.createdAt, cutoff));
	const items = await db.select().from(orderItems);
	const allDesigns = await db.select().from(designs);
	const spent = await db.select().from(expenses).where(and(gte(expenses.date, cutoff)));

	const itemsByOrder = new Map<number, (typeof items)[number][]>();
	for (const i of items) {
		const list = itemsByOrder.get(i.orderId) ?? [];
		list.push(i);
		itemsByOrder.set(i.orderId, list);
	}

	const rows = all
		.filter((o) => o.status !== 'cancelled')
		.map((o) => ({ o, e: economics(o, itemsByOrder.get(o.id) ?? []) }));

	const sales = rows.filter((r) => r.o.kind === 'sale' && r.o.status !== 'returned');
	const gifts = rows.filter((r) => r.o.kind === 'gift' && r.o.status !== 'returned');
	const returned = rows.filter((r) => r.o.status === 'returned');

	const sum = (list: typeof rows, f: (e: Economics) => number) => list.reduce((a, r) => a + f(r.e), 0);

	const revenue = sum(sales, (e) => e.revenue);
	const unitsSold = sum(sales, (e) => e.units);
	const cost = {
		blank: sum(sales, (e) => e.blank),
		dtf: sum(sales, (e) => e.dtf),
		labor: sum(sales, (e) => e.labor),
		packaging: sum(sales, (e) => e.packaging),
		shipping: sum(sales, (e) => e.shipping)
	};
	const salesProfit = sum(sales, (e) => e.profit);
	const giftCost = sum(gifts, (e) => e.cost);
	const returnLoss = sum(returned, (e) => e.cost);
	const net = salesProfit - giftCost - returnLoss;
	const laborAll = sum(rows, (e) => e.labor);

	// One average shirt: where its price goes.
	const per = (v: number) => (unitsSold > 0 ? v / unitsSold : 0);
	const perShirt = {
		price: per(revenue),
		blank: per(cost.blank),
		dtf: per(cost.dtf),
		labor: per(cost.labor),
		packaging: per(cost.packaging),
		shipping: per(cost.shipping),
		profit: per(salesProfit)
	};

	const collected = sales.filter((r) => r.o.paymentStatus === 'paid').reduce((a, r) => a + r.e.revenue, 0);
	const outstanding = sales.filter((r) => r.o.paymentStatus !== 'paid').reduce((a, r) => a + r.e.revenue, 0);

	// Money that actually went out: purchases, plus courier fees (taken off the payout).
	const expensesByCategory = new Map<string, number>();
	for (const x of spent) expensesByCategory.set(x.category, (expensesByCategory.get(x.category) ?? 0) + x.amount);
	const expensesTotal = spent.reduce((a, x) => a + x.amount, 0);
	const courierFees = rows.filter((r) => r.o.shippedAt || r.o.deliveredAt).reduce((a, r) => a + r.o.shippingCost, 0);

	const byMonth = new Map<string, { revenue: number; profit: number; orders: number }>();
	for (const r of rows) {
		const d = new Date(r.o.createdAt * 1000);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const cur = byMonth.get(key) ?? { revenue: 0, profit: 0, orders: 0 };
		cur.revenue += r.e.revenue;
		cur.profit += r.e.profit;
		cur.orders += 1;
		byMonth.set(key, cur);
	}

	const byChannel = new Map<string, Bucket>();
	const byCountry = new Map<string, Bucket>();
	const byDelivery = new Map<string, Bucket>();
	for (const r of sales) {
		add(byChannel, r.o.channel, r.e);
		add(byCountry, r.o.country, r.e);
		add(byDelivery, r.o.deliveryMethod, r.e);
	}

	const saleIds = new Set(sales.map((r) => r.o.id));
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));
	const byDesign = new Map<string, number>();
	const byColor = new Map<string, number>();
	for (const i of items) {
		if (!saleIds.has(i.orderId)) continue;
		const name = i.isCustom ? 'I personalizuar' : i.designId ? (designName.get(i.designId) ?? 'I panjohur') : 'Pa print';
		byDesign.set(name, (byDesign.get(name) ?? 0) + i.quantity);
		byColor.set(i.color, (byColor.get(i.color) ?? 0) + i.quantity);
	}

	return {
		revenue,
		unitsSold,
		orderCount: sales.length,
		avgOrder: sales.length ? revenue / sales.length : 0,
		cost,
		costTotal: cost.blank + cost.dtf + cost.labor + cost.packaging + cost.shipping,
		salesProfit,
		margin: revenue > 0 ? salesProfit / revenue : 0,
		gifts: { orders: gifts.length, units: sum(gifts, (e) => e.units), cost: giftCost },
		returns: { orders: returned.length, loss: returnLoss },
		net,
		/** Net profit plus the labour you charged yourself: what you keep doing the work yourself. */
		netWithLabor: net + laborAll,
		perShirt,
		collected,
		outstanding,
		expensesTotal,
		expensesByCategory: [...expensesByCategory.entries()]
			.map(([category, amount]) => ({ category, amount }))
			.sort((a, b) => b.amount - a.amount),
		courierFees,
		cashBalance: collected - expensesTotal - courierFees,
		byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
		byChannel: sorted(byChannel),
		byCountry: sorted(byCountry),
		byDelivery: sorted(byDelivery),
		byDesign: [...byDesign.entries()].sort((a, b) => b[1] - a[1]).map(([name, units]) => ({ name, units })),
		byColor: [...byColor.entries()].sort((a, b) => b[1] - a[1]).map(([color, units]) => ({ color, units }))
	};
}
