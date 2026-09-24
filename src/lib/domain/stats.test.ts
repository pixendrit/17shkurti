import { describe, expect, it } from 'vitest';
import { financials, outstanding } from './stats';
import { customer, line, order, T0, world } from './testing';
import { DAY } from './time';

const now = T0 + 10 * DAY;
const sale = order({ id: 's', lines: [line({ quantity: 2 })], status: 'delivered', handedOverAt: T0 + DAY, deliveredAt: T0 + 2 * DAY });
const gift = order({ id: 'g', kind: 'gift', lines: [line({ unitPrice: 0 })], delivery: { method: 'hand', cost: 0 } });
const back = order({ id: 'r', status: 'returned', handedOverAt: T0, customerId: 'C2' });
const gone = order({ id: 'c', status: 'cancelled' });
const old = order({ id: 'o', createdAt: T0 - 100 * DAY });

const w = world({
	customers: [customer(), customer({ id: 'C2', country: 'AL' })],
	orders: [sale, gift, back, gone, old],
	payments: [{ id: 'p', orderId: 's', amount: 5000, method: 'cod', receivedAt: T0 + 3 * DAY }],
	purchases: [{ id: 'x', date: T0, note: '', isDemo: false, kind: 'expense', category: 'marketing', amount: 1000 }]
});

describe('financials over 30 days', () => {
	const s = financials(w, 30, now);

	it('counts sales, and leaves out cancellations and older orders', () => {
		expect(s.orderCount).toBe(1);
		expect(s.revenue).toBe(5000);
		expect(s.unitsSold).toBe(2);
		expect(s.salesProfit).toBe(5000 - 2862);
	});

	it('takes gifts and returns off the net', () => {
		expect(s.gifts).toEqual({ orders: 1, units: 1, cost: 1312 });
		expect(s.returns).toEqual({ orders: 1, loss: 262 });
		expect(s.net).toBe(5000 - 2862 - 1312 - 262);
	});

	it('shows where one shirt’s price goes', () =>
		expect(s.perShirt).toEqual({ price: 2500, blank: 800, dtf: 300, labor: 200, packaging: 6, delivery: 125, profit: 1069 }));

	it('follows the money that moved', () => {
		expect(s.collected).toBe(5000);
		expect(s.spent).toBe(1000);
		expect(s.deliveryCosts).toBe(500); // the sale and the return both went by courier
		expect(s.cashBalance).toBe(3500);
	});

	it('groups sales', () => {
		expect(s.byChannel).toEqual([{ key: 'instagram', orders: 1, units: 2, revenue: 5000, profit: 2138 }]);
		expect(s.byDesign).toEqual([{ key: 'Shqiponja', units: 2 }]);
		expect(s.byMonth).toHaveLength(1);
	});
});

describe('all time and outstanding', () => {
	it('includes old orders over all time', () => expect(financials(w, 0, now).orderCount).toBe(2));
	it('counts what live sales still owe', () => expect(outstanding(w)).toBe(2500)); // the old order
});
