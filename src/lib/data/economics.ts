/**
 * The one place that decides what an order earned and cost. The dashboard,
 * order page, orders list and stats all call this, so they can't disagree.
 */

type EconOrder = {
	kind: string;
	status: string;
	shippingFee: number;
	discount: number;
	shippingCost: number;
	packagingCost: number;
};

type EconItem = {
	quantity: number;
	unitPrice: number;
	unitCost: number;
	blankCost: number;
	dtfCost: number;
	laborCost: number;
};

export type Economics = {
	units: number;
	/** Price of the shirts, before shipping and discount. */
	subtotal: number;
	/** Money the order brings in. 0 for gifts, returns and cancellations. */
	revenue: number;
	blank: number;
	dtf: number;
	labor: number;
	packaging: number;
	shipping: number;
	cost: number;
	profit: number;
};

const ZERO: Omit<Economics, 'units' | 'subtotal'> = {
	revenue: 0,
	blank: 0,
	dtf: 0,
	labor: 0,
	packaging: 0,
	shipping: 0,
	cost: 0,
	profit: 0
};

export function economics(order: EconOrder, items: EconItem[]): Economics {
	const units = items.reduce((a, i) => a + i.quantity, 0);
	const subtotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);

	// Cancelled before it went anywhere: nothing earned, nothing spent.
	if (order.status === 'cancelled') return { units, subtotal, ...ZERO };

	// Came back from the courier: no money in, but the courier fee and the
	// packaging are gone. The shirt itself is back on the shelf.
	if (order.status === 'returned') {
		const cost = order.shippingCost + order.packagingCost;
		return {
			units,
			subtotal,
			...ZERO,
			packaging: order.packagingCost,
			shipping: order.shippingCost,
			cost,
			profit: -cost
		};
	}

	let blank = 0;
	let dtf = 0;
	let labor = 0;
	for (const i of items) {
		// Rows created before the cost breakdown existed only have unitCost.
		const split = i.blankCost + i.dtfCost + i.laborCost > 0;
		blank += i.quantity * (split ? i.blankCost : i.unitCost);
		dtf += i.quantity * (split ? i.dtfCost : 0);
		labor += i.quantity * (split ? i.laborCost : 0);
	}

	const revenue = order.kind === 'gift' ? 0 : subtotal + order.shippingFee - order.discount;
	const cost = blank + dtf + labor + order.packagingCost + order.shippingCost;
	return {
		units,
		subtotal,
		revenue,
		blank,
		dtf,
		labor,
		packaging: order.packagingCost,
		shipping: order.shippingCost,
		cost,
		profit: revenue - cost
	};
}
