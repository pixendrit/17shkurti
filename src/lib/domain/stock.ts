/**
 * The stock ledger: what's on the shelf, what open orders need from it, and
 * who gets it first.
 */
import type { Movement, Order, Sku, Subject, World } from './model';
import { isUnmade } from './process';

/**
 * subjectKey : Subject -> String
 * A subject as a map key: equal subjects, equal keys.
 *   blank oversized black M -> "blank:oversized_200g/black/M"    print P1 -> "print:P1"
 */
export const subjectKey = (s: Subject): string =>
	s.kind === 'blank' ? `blank:${s.sku.garment}/${s.sku.color}/${s.sku.size}` : `print:${s.printId}`;

export const blank = (sku: Sku): Subject => ({ kind: 'blank', sku: { ...sku } });
export const printSubject = (printId: string): Subject => ({ kind: 'print', printId });

/** Need: a quantity of one subject. */
export type Need = { subject: Subject; quantity: number };

/** Adds a need to a map of needs by subject. */
function add(into: Map<string, Need>, subject: Subject, quantity: number) {
	const key = subjectKey(subject);
	const cur = into.get(key);
	if (cur) cur.quantity += quantity;
	else into.set(key, { subject, quantity });
}

/**
 * onHand : [Movement] -> Map<key, Number>
 * What's on the shelf: the sum of each subject's movements.
 */
export function onHand(movements: readonly Movement[]): Map<string, number> {
	const m = new Map<string, number>();
	for (const mv of movements) {
		const k = subjectKey(mv.subject);
		m.set(k, (m.get(k) ?? 0) + mv.delta);
	}
	return m;
}

/**
 * needs : Order -> Map<key, Need>
 * What making the order takes from the shelf: a blank per shirt, and a
 * catalogue print per printed shirt. A custom print is made for the order
 * alone, so it's never on the shelf. Nothing for untracked orders.
 */
export function needs(order: Order): Map<string, Need> {
	const m = new Map<string, Need>();
	if (!order.stockTracked) return m;
	for (const l of order.lines) {
		add(m, blank(l.sku), l.quantity);
		if (l.artwork.kind === 'print') add(m, printSubject(l.artwork.printId), l.quantity);
	}
	return m;
}

/** customPending : Order -> Number — shirts whose personalised print hasn't arrived. */
export const customPending = (order: Order): number =>
	order.lines.reduce((a, l) => a + (l.artwork.kind === 'custom' && !l.artwork.printReady ? l.quantity : 0), 0);

/**
 * shortfall : Map<key, Number> Order -> [Need]
 * What's missing from the shelf to make the order right now.
 */
export function shortfall(have: Map<string, number>, order: Order): Need[] {
	const out: Need[] = [];
	for (const [k, n] of needs(order)) {
		const missing = n.quantity - Math.max(0, have.get(k) ?? 0);
		if (missing > 0) out.push({ subject: n.subject, quantity: missing });
	}
	return out;
}

/**
 * Readiness: can an open order be made with what's on the shelf, once older
 * orders have taken theirs?
 *   short:         what's still missing for it
 *   customPending: personalised shirts waiting for their print
 */
export type Readiness = { short: Need[]; customPending: number; ready: boolean };

/** Orders are served in the order they came in; the code breaks ties. */
const byArrival = (a: Order, b: Order) => a.createdAt - b.createdAt || a.code.localeCompare(b.code);

/**
 * allocate : World -> Map<orderId, Readiness>
 * Shares the shelf among the unmade orders, oldest first, subject by subject:
 * an older order keeps what it can get even while it waits for the rest, so
 * the last shirt never counts as ready for two orders.
 */
export function allocate(w: Pick<World, 'orders' | 'movements'>): Map<string, Readiness> {
	const left = onHand(w.movements);
	const out = new Map<string, Readiness>();
	for (const o of w.orders.filter(isUnmade).sort(byArrival)) {
		const short: Need[] = [];
		for (const [k, n] of needs(o)) {
			const have = Math.max(0, left.get(k) ?? 0);
			const take = Math.min(have, n.quantity);
			left.set(k, have - take);
			if (take < n.quantity) short.push({ subject: n.subject, quantity: n.quantity - take });
		}
		const pending = customPending(o);
		out.set(o.id, { short, customPending: pending, ready: short.length === 0 && pending === 0 });
	}
	return out;
}

/**
 * ShelfRow: one subject on the shelf.
 *   have:     on the shelf now
 *   reserved: wanted by unmade orders
 *   short:    what to buy or print to cover them all (reserved − have, if more)
 */
export type ShelfRow = { subject: Subject; key: string; have: number; reserved: number; short: number };

/**
 * shelf : World -> [ShelfRow]
 * Every subject that has ever had stock or is wanted by an unmade order.
 */
export function shelf(w: Pick<World, 'orders' | 'movements'>): ShelfRow[] {
	const have = onHand(w.movements);
	const subjects = new Map<string, Subject>();
	for (const mv of w.movements) subjects.set(subjectKey(mv.subject), mv.subject);
	const reserved = new Map<string, number>();
	for (const o of w.orders.filter(isUnmade))
		for (const [k, n] of needs(o)) {
			subjects.set(k, n.subject);
			reserved.set(k, (reserved.get(k) ?? 0) + n.quantity);
		}
	return [...subjects].map(([key, subject]) => {
		const h = have.get(key) ?? 0;
		const r = reserved.get(key) ?? 0;
		return { subject, key, have: h, reserved: r, short: Math.max(0, r - Math.max(0, h)) };
	});
}
