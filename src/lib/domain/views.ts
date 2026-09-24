/**
 * What each page shows: pure projections of the world. A page's load is
 * `view(await loadWorld(db))` — one round trip, then plain computation.
 */
import { balance, blankCost, economics, paid, purchaseTotal } from './economics';
import { sum } from './money';
import {
	COLORS,
	GARMENTS,
	SIZES,
	type Customer,
	type Id,
	type Order,
	type OrderLine,
	type Purchase,
	type World
} from './model';
import { COLOR_LABELS, EXPENSE_LABELS, GARMENT_LABELS, printLabel, skuLabel, statusLabel, subjectLabel } from './labels';
import { isOpen, isUnmade, possibleEvents } from './process';
import { outstanding, financials } from './stats';
import { allocate, customPending, shelf, subjectKey, type Need } from './stock';
import type { Instant } from './time';

// ---- Orders -------------------------------------------------------------------

/** lineLabel : World OrderLine -> String — "2 × Shqiponja · Oversized 200gr · E zezë · L" */
export function lineLabel(w: World, l: OrderLine): string {
	const art =
		l.artwork.kind === 'print'
			? (w.designs.find((d) => d.id === w.prints.find((p) => p.id === (l.artwork as { printId: Id }).printId)?.designId)?.name ?? 'Print')
			: l.artwork.kind === 'custom'
				? 'I personalizuar'
				: 'Pa print';
	return `${l.quantity} × ${art} · ${skuLabel(l.sku)}`;
}

/** OrderRow: an order as one line of a list. */
export type OrderRow = ReturnType<typeof orderRow>;

export function orderRow(w: World, o: Order, customers: Map<Id, Customer>) {
	const c = customers.get(o.customerId);
	const e = economics(o);
	return {
		id: o.id,
		code: o.code,
		customer: c?.name ?? '—',
		phone: c?.phone ?? '',
		city: c?.city ?? '',
		kind: o.kind,
		channel: o.channel,
		method: o.delivery.method,
		trackingRef: o.delivery.method === 'courier' ? o.delivery.trackingRef : '',
		status: o.status,
		statusLabel: statusLabel(o),
		units: e.units,
		total: e.revenue,
		balance: balance(o, w.payments),
		summary: o.lines.map((l) => lineLabel(w, l)).join(', '),
		custom: o.lines.some((l) => l.artwork.kind === 'custom'),
		createdAt: o.createdAt,
		isDemo: o.isDemo
	};
}

const newestFirst = (a: Order, b: Order) => b.createdAt - a.createdAt || b.code.localeCompare(a.code);
const customerMap = (w: World) => new Map(w.customers.map((c) => [c.id, c]));

export const ORDER_TABS = ['open', 'with_courier', 'unpaid', 'done', 'closed', 'all'] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export const ORDER_TAB_LABELS: Record<OrderTab, string> = {
	open: 'Të hapura',
	with_courier: 'Te postieri',
	unpaid: 'Pa paguar',
	done: 'Të dorëzuara',
	closed: 'Kthyer / anuluar',
	all: 'Të gjitha'
};

/** inTab : World OrderTab Order -> Boolean */
function inTab(w: World, tab: OrderTab, o: Order): boolean {
	switch (tab) {
		case 'open':
			return isOpen(o);
		case 'with_courier':
			return o.status === 'with_courier';
		case 'unpaid':
			return o.kind === 'sale' && o.status !== 'cancelled' && o.status !== 'returned' && balance(o, w.payments) > 0;
		case 'done':
			return o.status === 'delivered';
		case 'closed':
			return o.status === 'returned' || o.status === 'cancelled';
		case 'all':
			return true;
	}
}

/** matches : String OrderRow -> Boolean — the search finds code, name, phone, city or courier number. */
function matches(q: string, r: OrderRow): boolean {
	const t = q.trim().toLowerCase();
	if (!t) return true;
	const digits = t.replace(/\D/g, '');
	return (
		[r.code, r.customer, r.city, r.trackingRef].some((x) => x.toLowerCase().includes(t)) ||
		(digits.length >= 3 && r.phone.replace(/\D/g, '').includes(digits))
	);
}

/** ordersView : World OrderTab String -> the orders page */
export function ordersView(w: World, tab: OrderTab, q: string) {
	const customers = customerMap(w);
	const counts = Object.fromEntries(ORDER_TABS.map((t) => [t, w.orders.filter((o) => inTab(w, t, o)).length])) as Record<OrderTab, number>;
	const plan = allocate(w);
	const rows = w.orders
		.filter((o) => (q.trim() ? true : inTab(w, tab, o)))
		.sort(newestFirst)
		.map((o) => ({ ...orderRow(w, o, customers), canMake: plan.get(o.id)?.ready ?? null }))
		.filter((r) => matches(q, r));
	return { tab, q, counts, rows, total: sum(rows, (r) => r.total) };
}

/** needLabel : World Need -> String — "3 × Oversized 200gr · E zezë · M" */
export const needLabel = (w: World, n: Need) => `${n.quantity} × ${subjectLabel(w, n.subject)}`;

/** orderView : World Id -> the order page, or null if there's no such order */
export function orderView(w: World, id: Id) {
	const o = w.orders.find((x) => x.id === id);
	if (!o) return null;
	const customer = w.customers.find((c) => c.id === o.customerId) ?? null;
	const readiness = isUnmade(o) ? allocate(w).get(o.id) ?? null : null;
	const history = w.orders.filter((x) => x.customerId === o.customerId && x.id !== o.id).sort(newestFirst);
	const customers = customerMap(w);
	return {
		order: o,
		customer,
		statusLabel: statusLabel(o),
		lines: o.lines.map((l) => {
			const print = l.artwork.kind === 'print' ? w.prints.find((p) => p.id === (l.artwork as { printId: Id }).printId) : undefined;
			return {
				line: l,
				label: lineLabel(w, l),
				printName: l.artwork.kind === 'print' ? printLabel(w, l.artwork.printId) : null,
				images: l.artwork.kind === 'custom' ? { front: l.artwork.front, back: l.artwork.back } : { front: print?.front ?? null, back: print?.back ?? null }
			};
		}),
		economics: economics(o),
		payments: w.payments.filter((p) => p.orderId === o.id),
		paid: paid(w.payments, o.id),
		balance: balance(o, w.payments),
		events: possibleEvents(o),
		readiness: readiness && {
			ready: readiness.ready,
			customPending: readiness.customPending,
			short: readiness.short.map((n) => needLabel(w, n))
		},
		movements: w.movements
			.filter((m) => m.orderId === o.id)
			.map((m) => ({ id: m.id, delta: m.delta, reason: m.reason, label: subjectLabel(w, m.subject), at: m.at })),
		history: history.slice(0, 10).map((x) => orderRow(w, x, customers)),
		historyCount: history.length
	};
}

// ---- Dashboard ----------------------------------------------------------------

/** dashboardView : World Instant -> the home page: what to do now */
export function dashboardView(w: World, now: Instant) {
	const customers = customerMap(w);
	const plan = allocate(w);
	const unmade = w.orders.filter(isUnmade).sort((a, b) => a.createdAt - b.createdAt);
	const row = (o: Order) => orderRow(w, o, customers);
	const rows = shelf(w);
	const s30 = financials(w, 30, now);
	return {
		openCount: w.orders.filter(isOpen).length,
		newCount: w.orders.filter((o) => o.status === 'new').length,
		canMake: unmade.filter((o) => plan.get(o.id)?.ready).map(row),
		blocked: unmade
			.filter((o) => !plan.get(o.id)?.ready)
			.map((o) => {
				const r = plan.get(o.id)!;
				const missing = r.short.map((n) => needLabel(w, n));
				if (r.customPending) missing.push(`${r.customPending} print i personalizuar`);
				return { ...row(o), missing };
			}),
		ready: w.orders.filter((o) => o.status === 'ready').sort(newestFirst).map(row),
		waitingCourier: w.orders.filter((o) => o.status === 'ready' && o.delivery.method === 'courier').length,
		withCourier: w.orders.filter((o) => o.status === 'with_courier').length,
		deliveredUnpaid: sum(
			w.orders.filter((o) => o.kind === 'sale' && o.status === 'delivered'),
			(o) => Math.max(0, balance(o, w.payments))
		),
		toBuy: sum(rows.filter((r) => r.subject.kind === 'blank'), (r) => r.short),
		toPrint: rows
			.filter((r) => r.subject.kind === 'print' && r.short > 0)
			.map((r) => ({ label: r.subject.kind === 'print' ? printLabel(w, r.subject.printId) : '', short: r.short })),
		customPending: sum(w.orders.filter(isUnmade), customPending),
		revenue30: s30.revenue,
		net30: s30.net,
		outstanding: outstanding(w)
	};
}

// ---- Shipments ----------------------------------------------------------------

/** shipmentsView : World -> the courier's side of things */
export function shipmentsView(w: World) {
	const customers = customerMap(w);
	const rows = (f: (o: Order) => boolean) =>
		w.orders.filter(f).sort((a, b) => a.createdAt - b.createdAt).map((o) => orderRow(w, o, customers));
	return {
		waiting: rows((o) => o.status === 'ready' && o.delivery.method === 'courier'),
		withCourier: rows((o) => o.status === 'with_courier'),
		handReady: rows((o) => o.status === 'ready' && o.delivery.method === 'hand'),
		unpaid: rows((o) => o.kind === 'sale' && o.status === 'delivered' && balance(o, w.payments) > 0)
	};
}

// ---- Stock --------------------------------------------------------------------

/** stockView : World -> the shelf, what to buy and print, and the recent ledger */
export function stockView(w: World) {
	const rows = new Map(shelf(w).map((r) => [r.key, r]));
	const cell = (key: string) => {
		const r = rows.get(key);
		return { key, have: r?.have ?? 0, reserved: r?.reserved ?? 0, short: r?.short ?? 0 };
	};
	const blanks = GARMENTS.flatMap((garment) =>
		COLORS.map((color) => ({
			garment,
			color,
			label: `${GARMENT_LABELS[garment]} · ${COLOR_LABELS[color]}`,
			cost: blankCost(w, garment),
			sizes: SIZES.map((size) => ({ size, ...cell(subjectKey({ kind: 'blank', sku: { garment, color, size } })) }))
		}))
	).filter((g) => g.sizes.some((s) => s.have !== 0 || s.reserved > 0) || g.garment === 'oversized_200g');

	const designName = new Map(w.designs.map((d) => [d.id, d]));
	const prints = w.prints
		.map((p) => ({
			printId: p.id,
			design: designName.get(p.designId)?.name ?? '?',
			archived: designName.get(p.designId)?.archived ?? false,
			color: p.shirtColor,
			front: p.front,
			perSheet: p.perSheet,
			...cell(subjectKey({ kind: 'print', printId: p.id }))
		}))
		.filter((p) => !p.archived || p.have !== 0 || p.reserved > 0)
		.sort((a, b) => a.design.localeCompare(b.design) || a.color.localeCompare(b.color));

	const custom = w.orders
		.filter(isUnmade)
		.flatMap((o) =>
			o.lines
				.filter((l) => l.artwork.kind === 'custom' && !l.artwork.printReady)
				.map((l) => ({
					orderId: o.id,
					lineId: l.id,
					code: o.code,
					quantity: l.quantity,
					label: skuLabel(l.sku),
					front: l.artwork.kind === 'custom' ? l.artwork.front : null,
					back: l.artwork.kind === 'custom' ? l.artwork.back : null
				}))
		);

	const orderCode = new Map(w.orders.map((o) => [o.id, o.code]));
	const ledger = [...w.movements]
		.sort((a, b) => b.at - a.at)
		.slice(0, 60)
		.map((m) => ({
			id: m.id,
			at: m.at,
			delta: m.delta,
			reason: m.reason,
			note: m.note,
			label: subjectLabel(w, m.subject),
			orderId: m.orderId,
			orderCode: m.orderId ? (orderCode.get(m.orderId) ?? null) : null
		}));

	return {
		blanks,
		prints,
		custom,
		ledger,
		toBuy: blanks.flatMap((g) => g.sizes.filter((s) => s.short > 0).map((s) => ({ label: `${g.label} · ${s.size}`, short: s.short }))),
		toPrint: prints.filter((p) => p.short > 0)
	};
}

// ---- Purchases ----------------------------------------------------------------

/** purchaseSummary : World Purchase -> String — what was bought, in a few words */
export function purchaseSummary(w: World, p: Purchase): string {
	switch (p.kind) {
		case 'blanks':
			return p.lines.map((l) => `${l.quantity} × ${skuLabel(l.sku)}`).join(', ');
		case 'dtf':
			return `${p.sheets} fletë${p.lines.length ? ': ' + p.lines.map((l) => `${l.quantity} × ${printLabel(w, l.printId)}`).join(', ') : ''}`;
		case 'expense':
			return EXPENSE_LABELS[p.category];
	}
}

/** purchasesView : World -> money out, newest first */
export function purchasesView(w: World) {
	const list = [...w.purchases].sort((a, b) => b.date - a.date);
	return {
		rows: list.map((p) => ({ id: p.id, kind: p.kind, date: p.date, note: p.note, isDemo: p.isDemo, total: purchaseTotal(p), summary: purchaseSummary(w, p) })),
		total: sum(list, purchaseTotal)
	};
}

// ---- Designs ------------------------------------------------------------------

/** designsView : World -> the catalogue, with what each print has sold and has on the shelf */
export function designsView(w: World) {
	const have = new Map(shelf(w).map((r) => [r.key, r.have]));
	const sold = new Map<Id, number>();
	for (const o of w.orders)
		if (o.status !== 'cancelled')
			for (const l of o.lines) if (l.artwork.kind === 'print') sold.set(l.artwork.printId, (sold.get(l.artwork.printId) ?? 0) + l.quantity);
	return w.designs
		.map((d) => {
			const prints = w.prints
				.filter((p) => p.designId === d.id)
				.sort((a, b) => COLORS.indexOf(a.shirtColor) - COLORS.indexOf(b.shirtColor))
				.map((p) => ({ ...p, have: have.get(`print:${p.id}`) ?? 0, sold: sold.get(p.id) ?? 0 }));
			return { ...d, prints, sold: sum(prints, (p) => p.sold) };
		})
		.sort((a, b) => Number(a.archived) - Number(b.archived) || b.sold - a.sold || a.name.localeCompare(b.name));
}

// ---- Customers ----------------------------------------------------------------

/** customersView : World String -> customers with what they bought, best first */
export function customersView(w: World, q: string) {
	const t = q.trim().toLowerCase();
	const digits = t.replace(/\D/g, '');
	return w.customers
		.map((c) => {
			const orders = w.orders.filter((o) => o.customerId === c.id && o.status !== 'cancelled');
			return {
				...c,
				orders: orders.length,
				gifts: orders.filter((o) => o.kind === 'gift').length,
				spent: sum(orders, (o) => economics(o).revenue),
				last: orders.reduce((m, o) => Math.max(m, o.createdAt), 0)
			};
		})
		.filter(
			(c) =>
				!t ||
				c.name.toLowerCase().includes(t) ||
				c.city.toLowerCase().includes(t) ||
				(digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))
		)
		.sort((a, b) => b.spent - a.spent || b.orders - a.orders || a.name.localeCompare(b.name));
}
