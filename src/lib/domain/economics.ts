/**
 * Money per order: what a shirt costs to make, what an order earned, and
 * what it's still owed. The one place that decides these, so the order page,
 * lists and stats can't disagree.
 */
import { divide, sum, type Cents } from './money';
import type { Artwork, Country, Delivery, Garment, LineCost, Order, Payment, Purchase, World } from './model';

/** PurchaseLike: a purchase, saved or not yet — whatever says what was bought. */
export type PurchaseLike =
	| Pick<Extract<Purchase, { kind: 'blanks' }>, 'kind' | 'lines'>
	| Pick<Extract<Purchase, { kind: 'dtf' }>, 'kind' | 'sheets' | 'sheetPrice'>
	| Pick<Extract<Purchase, { kind: 'expense' }>, 'kind' | 'amount'>;

/**
 * blankCost : World Garment -> Cents
 * What one blank of this garment costs: the average paid for every one
 * bought through the app, weighted by how many; until then, Settings.
 */
export function blankCost(w: Pick<World, 'purchases' | 'settings'>, garment: Garment): Cents {
	let pieces = 0;
	let paid = 0;
	for (const p of w.purchases)
		if (p.kind === 'blanks')
			for (const l of p.lines)
				if (l.sku.garment === garment) {
					pieces += l.quantity;
					paid += l.quantity * l.unitCost;
				}
	return pieces > 0 ? divide(paid, pieces) : w.settings.blankCost[garment];
}

/**
 * lineCost : World Garment Artwork -> LineCost
 * What one shirt costs to make today: the blank, its share of a DTF sheet,
 * and the work.
 */
export function lineCost(w: Pick<World, 'purchases' | 'settings' | 'prints'>, garment: Garment, art: Artwork): LineCost {
	const s = w.settings;
	const perSheet =
		art.kind === 'print'
			? (w.prints.find((p) => p.id === art.printId)?.perSheet ?? s.customPerSheet)
			: s.customPerSheet;
	return {
		blank: blankCost(w, garment),
		dtf: art.kind === 'none' ? 0 : divide(s.sheetPrice, perSheet),
		labor: s.laborPerShirt
	};
}

/**
 * deliveryCost : Settings DeliveryMethod Country -> Cents
 * What the shop pays to get an order there: the courier's price for the
 * country, nothing for a hand delivery.
 */
export const deliveryCost = (s: World['settings'], method: Delivery['method'], country: Country): Cents =>
	method === 'courier' ? s.courierCost[country] : 0;

/**
 * Economics: one order in money.
 *   subtotal: the shirts at their price, before shipping and discount
 *   revenue:  what the order brings in
 *   blank, dtf, labor, packaging, delivery: what it cost, by part
 *   profit:   revenue − cost
 */
export type Economics = {
	units: number;
	subtotal: Cents;
	revenue: Cents;
	blank: Cents;
	dtf: Cents;
	labor: Cents;
	packaging: Cents;
	delivery: Cents;
	cost: Cents;
	profit: Cents;
};

/**
 * economics : Order -> Economics
 *   sale:      revenue = subtotal + shipping charged − discount; costs all parts
 *   gift:      revenue 0; costs all parts — it's marketing
 *   returned:  revenue 0; costs the delivery and packaging only (the shirt is
 *              back and can be sold again)
 *   cancelled: nothing either way
 */
export function economics(o: Order): Economics {
	const units = sum(o.lines, (l) => l.quantity);
	const subtotal = sum(o.lines, (l) => l.quantity * l.unitPrice);
	const zero = { units, subtotal, revenue: 0, blank: 0, dtf: 0, labor: 0, packaging: 0, delivery: 0, cost: 0, profit: 0 };
	if (o.status === 'cancelled') return zero;
	if (o.status === 'returned') {
		const cost = o.packaging + o.delivery.cost;
		return { ...zero, packaging: o.packaging, delivery: o.delivery.cost, cost, profit: -cost };
	}
	const blank = sum(o.lines, (l) => l.quantity * l.cost.blank);
	const dtf = sum(o.lines, (l) => l.quantity * l.cost.dtf);
	const labor = sum(o.lines, (l) => l.quantity * l.cost.labor);
	const revenue = o.kind === 'gift' ? 0 : subtotal + o.shippingCharged - o.discount;
	const cost = blank + dtf + labor + o.packaging + o.delivery.cost;
	return { units, subtotal, revenue, blank, dtf, labor, packaging: o.packaging, delivery: o.delivery.cost, cost, profit: revenue - cost };
}

/** owed : Order -> Cents — what the customer has to pay in all. */
export const owed = (o: Order): Cents => economics(o).revenue;

/** paid : [Payment] Id -> Cents — what has come in for an order. */
export const paid = (payments: readonly Payment[], orderId: string): Cents =>
	sum(payments.filter((p) => p.orderId === orderId), (p) => p.amount);

/**
 * balance : Order [Payment] -> Cents
 * What's still to come in: positive when the customer owes, negative when
 * the shop owes money back (paid, then returned).
 */
export const balance = (o: Order, payments: readonly Payment[]): Cents => owed(o) - paid(payments, o.id);

/** purchaseTotal : Purchase -> Cents — what was paid. */
export function purchaseTotal(p: PurchaseLike): Cents {
	switch (p.kind) {
		case 'blanks':
			return sum(p.lines, (l) => l.quantity * l.unitCost);
		case 'dtf':
			return p.sheets * p.sheetPrice;
		case 'expense':
			return p.amount;
	}
}
