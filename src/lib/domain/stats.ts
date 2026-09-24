/**
 * The shop's numbers over a period.
 */
import { balance, economics, purchaseTotal, type Economics } from './economics';
import { sum, type Cents } from './money';
import type { Color, Garment, Order, World } from './model';
import { isLive } from './process';
import { DAY, monthKey, type Instant } from './time';

/** Period: the last n days, or 0 for all time. */
export type Period = 30 | 90 | 365 | 0;
export const PERIODS: Period[] = [30, 90, 365, 0];

/** since : Period Instant -> Instant — where the period starts (0: the beginning). */
export const since = (days: Period, now: Instant): Instant => (days === 0 ? 0 : now - days * DAY);

/** Bucket: orders grouped by something, summed. */
export type Bucket = { key: string; orders: number; units: number; revenue: Cents; profit: Cents };

/** group : [(Order, Economics)] (Order -> String) -> [Bucket], biggest revenue first */
function group(rows: { o: Order; e: Economics }[], keyOf: (o: Order) => string): Bucket[] {
	const m = new Map<string, Bucket>();
	for (const { o, e } of rows) {
		const k = keyOf(o);
		const b = m.get(k) ?? { key: k, orders: 0, units: 0, revenue: 0, profit: 0 };
		b.orders += 1;
		b.units += e.units;
		b.revenue += e.revenue;
		b.profit += e.profit;
		m.set(k, b);
	}
	return [...m.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

/** count : [X] (X -> String) (X -> Number) -> [{ key, units }], most first */
function count<X>(xs: X[], keyOf: (x: X) => string, n: (x: X) => number) {
	const m = new Map<string, number>();
	for (const x of xs) m.set(keyOf(x), (m.get(keyOf(x)) ?? 0) + n(x));
	return [...m].map(([key, units]) => ({ key, units })).sort((a, b) => b.units - a.units);
}

/**
 * financials : World Period Instant -> Stats
 * Orders count in the period they were taken; money in and out counts in the
 * period it moved.
 *   sales:   sold and not returned or cancelled
 *   gifts:   what influencer gifts cost
 *   returns: what parcels that came back cost
 *   net:     profit on sales, less gifts and returns
 */
export function financials(w: World, days: Period, now: Instant) {
	const from = since(days, now);
	const inPeriod = (t: Instant) => t >= from && t <= now;

	const rows = w.orders
		.filter((o) => o.status !== 'cancelled' && inPeriod(o.createdAt))
		.map((o) => ({ o, e: economics(o) }));
	const sales = rows.filter((r) => r.o.kind === 'sale' && r.o.status !== 'returned');
	const gifts = rows.filter((r) => r.o.kind === 'gift' && r.o.status !== 'returned');
	const returned = rows.filter((r) => r.o.status === 'returned');
	const total = (list: typeof rows, f: (e: Economics) => number) => sum(list, (r) => f(r.e));

	const revenue = total(sales, (e) => e.revenue);
	const unitsSold = total(sales, (e) => e.units);
	const cost = {
		blank: total(sales, (e) => e.blank),
		dtf: total(sales, (e) => e.dtf),
		labor: total(sales, (e) => e.labor),
		packaging: total(sales, (e) => e.packaging),
		delivery: total(sales, (e) => e.delivery)
	};
	const salesProfit = total(sales, (e) => e.profit);
	const giftCost = total(gifts, (e) => e.cost);
	const returnLoss = total(returned, (e) => e.cost);
	const net = salesProfit - giftCost - returnLoss;

	// One average shirt sold: where its price goes.
	const per = (v: Cents) => (unitsSold > 0 ? Math.round(v / unitsSold) : 0);

	// Money that actually moved in the period.
	const saleIds = new Set(w.orders.filter((o) => o.kind === 'sale').map((o) => o.id));
	const collected = sum(
		w.payments.filter((p) => saleIds.has(p.orderId) && inPeriod(p.receivedAt)),
		(p) => p.amount
	);
	const purchases = w.purchases.filter((p) => inPeriod(p.date));
	const spentBy = new Map<string, Cents>();
	for (const p of purchases) {
		const k = p.kind === 'expense' ? p.category : p.kind;
		spentBy.set(k, (spentBy.get(k) ?? 0) + purchaseTotal(p));
	}
	const spent = sum(purchases, purchaseTotal);
	const deliveryCosts = sum(
		w.orders.filter((o) => {
			const left = o.handedOverAt ?? o.deliveredAt;
			return left != null && inPeriod(left);
		}),
		(o) => o.delivery.cost
	);

	const byMonth = new Map<string, { month: string; orders: number; revenue: Cents; profit: Cents }>();
	for (const { o, e } of rows) {
		const k = monthKey(o.createdAt);
		const b = byMonth.get(k) ?? { month: k, orders: 0, revenue: 0, profit: 0 };
		b.orders += 1;
		b.revenue += e.revenue;
		b.profit += e.profit;
		byMonth.set(k, b);
	}

	const customerOf = new Map(w.customers.map((c) => [c.id, c]));
	const designOf = new Map(w.prints.map((p) => [p.id, w.designs.find((d) => d.id === p.designId)?.name ?? '?']));
	const soldLines = sales.flatMap((r) => r.o.lines);

	const buyers = count(sales.map((r) => r.o), (o) => o.customerId, () => 1);

	return {
		days,
		revenue,
		unitsSold,
		orderCount: sales.length,
		avgOrder: sales.length ? Math.round(revenue / sales.length) : 0,
		cost,
		salesProfit,
		margin: revenue > 0 ? salesProfit / revenue : 0,
		gifts: { orders: gifts.length, units: total(gifts, (e) => e.units), cost: giftCost },
		returns: { orders: returned.length, loss: returnLoss },
		net,
		/** Net profit plus the labour charged in costs: what's kept doing the work yourself. */
		netWithLabor: net + total(rows, (e) => e.labor),
		perShirt: {
			price: per(revenue),
			blank: per(cost.blank),
			dtf: per(cost.dtf),
			labor: per(cost.labor),
			packaging: per(cost.packaging),
			delivery: per(cost.delivery),
			profit: per(salesProfit)
		},
		collected,
		spent,
		spentBy: [...spentBy].map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount),
		deliveryCosts,
		cashBalance: collected - spent - deliveryCosts,
		/** Owed now by every live sale, whenever it was taken. */
		outstanding: outstanding(w),
		customers: buyers.length,
		returningCustomers: buyers.filter((b) => b.units > 1).length,
		byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
		byChannel: group(sales, (o) => o.channel),
		byCountry: group(sales, (o) => customerOf.get(o.customerId)?.country ?? 'OTHER'),
		byDelivery: group(sales, (o) => o.delivery.method),
		byDesign: count(
			soldLines,
			(l) => (l.artwork.kind === 'print' ? designOf.get(l.artwork.printId) ?? '?' : l.artwork.kind),
			(l) => l.quantity
		),
		byColor: count(soldLines, (l) => l.sku.color, (l) => l.quantity) as { key: Color; units: number }[],
		byGarment: count(soldLines, (l) => l.sku.garment, (l) => l.quantity) as { key: Garment; units: number }[]
	};
}

export type Stats = ReturnType<typeof financials>;

/** outstanding : World -> Cents — what live sales still owe, all together. */
export const outstanding = (w: World): Cents =>
	sum(
		w.orders.filter((o) => o.kind === 'sale' && isLive(o)),
		(o) => Math.max(0, balance(o, w.payments))
	);
