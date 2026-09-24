import { describe, expect, it } from 'vitest';
import { balance, blankCost, deliveryCost, economics, lineCost } from './economics';
import { DEFAULT_SETTINGS, type Purchase } from './model';
import { line, order, print, sku, T0, world } from './testing';

const blanks = (lines: [number, number][]): Purchase => ({
	id: `p${lines.length}`,
	date: T0,
	note: '',
	isDemo: false,
	kind: 'blanks',
	lines: lines.map(([quantity, unitCost]) => ({ sku: sku(), quantity, unitCost }))
});

describe('blankCost', () => {
	it('is the Settings price until blanks are bought', () => expect(blankCost(world(), 'oversized_200g')).toBe(800));
	it('is the weighted average of what was paid', () =>
		// 10 at 8,00 and 30 at 7,00: (80 + 210) / 40 = 7,25
		expect(blankCost(world({ purchases: [blanks([[10, 800]]), blanks([[30, 700], [0, 0]])] }), 'oversized_200g')).toBe(725));
});

describe('lineCost', () => {
	const w = world({ prints: [print({ perSheet: 6 })] });
	it('shares a sheet among the prints on it', () =>
		expect(lineCost(w, 'oversized_200g', { kind: 'print', printId: 'P-black' })).toEqual({ blank: 800, dtf: 200, labor: 200 }));
	it('uses the custom prints-per-sheet for personalised prints', () =>
		expect(lineCost(w, 'regular_fit', { kind: 'custom', front: 'f', back: 'b', printReady: false }).dtf).toBe(300));
	it('has no DTF on a plain shirt', () => expect(lineCost(w, 'oversized_200g', { kind: 'none' }).dtf).toBe(0));
});

describe('deliveryCost', () => {
	it('is the courier price for the country, or nothing by hand', () => {
		expect(deliveryCost(DEFAULT_SETTINGS, 'courier', 'XK')).toBe(250);
		expect(deliveryCost(DEFAULT_SETTINGS, 'courier', 'AL')).toBe(500);
		expect(deliveryCost(DEFAULT_SETTINGS, 'hand', 'AL')).toBe(0);
	});
});

describe('economics', () => {
	// 2 shirts at 25 €, each costing 8 + 3 + 2; packaging 0,12; courier 2,50
	const sale = order({ lines: [line({ quantity: 2 })] });

	it('a sale earns its price and costs every part', () =>
		expect(economics(sale)).toEqual({
			units: 2,
			subtotal: 5000,
			revenue: 5000,
			blank: 1600,
			dtf: 600,
			labor: 400,
			packaging: 12,
			delivery: 250,
			cost: 2862,
			profit: 2138
		}));

	it('counts shipping charged and discounts', () =>
		expect(economics(order({ shippingCharged: 200, discount: 500 })).revenue).toBe(2200));

	it('a bulk order: 13 shirts at 20 €', () => {
		const e = economics(order({ lines: [line({ quantity: 13, unitPrice: 2000 })], delivery: { method: 'hand', cost: 0 } }));
		expect(e).toMatchObject({ units: 13, revenue: 26000, cost: 13 * 1300 + 12, profit: 26000 - 13 * 1300 - 12 });
	});

	it('a gift earns nothing and costs everything', () =>
		expect(economics({ ...sale, kind: 'gift' })).toMatchObject({ revenue: 0, cost: 2862, profit: -2862 }));

	it('a return loses the delivery and the packaging', () =>
		expect(economics({ ...sale, status: 'returned' })).toMatchObject({ revenue: 0, blank: 0, cost: 262, profit: -262 }));

	it('a cancellation is nothing', () =>
		expect(economics({ ...sale, status: 'cancelled' })).toMatchObject({ revenue: 0, cost: 0, profit: 0, units: 2 }));
});

describe('balance', () => {
	const o = order();
	const pay = (amount: number) => ({ id: 'p', orderId: 'O1', amount, method: 'cod' as const, receivedAt: T0 });
	it('is what is owed less what came in', () => {
		expect(balance(o, [])).toBe(2500);
		expect(balance(o, [pay(2500)])).toBe(0);
		expect(balance(o, [{ ...pay(2500), orderId: 'other' }])).toBe(2500);
	});
	it('goes negative when a paid order comes back', () =>
		expect(balance({ ...o, status: 'returned' }, [pay(2500)])).toBe(-2500));
});
