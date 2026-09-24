import { describe, expect, it } from 'vitest';
import { dashboardView, lineLabel, orderView, ordersView, shipmentsView, stockView, customersView } from './views';
import { customer, line, order, sku, T0, world } from './testing';
import type { Movement } from './model';

const mv = (subject: Movement['subject'], delta: number, id: string): Movement => ({
	id, subject, delta, reason: 'purchase', note: '', orderId: null, purchaseId: null, at: T0
});

const w = world({
	customers: [customer(), customer({ id: 'C2', name: 'Besa', phone: '049 222 333', city: 'Gjakovë' })],
	orders: [
		order({ id: 'a', code: 'HS-0001', createdAt: T0 }),
		order({ id: 'b', code: 'HS-0002', createdAt: T0 + 1, customerId: 'C2', lines: [line({ quantity: 2 })] }),
		order({ id: 'c', code: 'HS-0003', status: 'ready', madeAt: T0 }),
		order({ id: 'd', code: 'HS-0004', status: 'delivered', madeAt: T0, handedOverAt: T0, deliveredAt: T0 }),
		order({ id: 'e', code: 'HS-0005', status: 'cancelled', cancelledAt: T0 })
	],
	movements: [mv({ kind: 'blank', sku: sku() }, 2, 'm1'), mv({ kind: 'print', printId: 'P-black' }, 2, 'm2')]
});

describe('lineLabel', () => {
	it('names the design, the shirt and how many', () =>
		expect(lineLabel(w, line({ quantity: 2 }))).toBe('2 × Shqiponja · Oversized 200gr · E zezë · M'));
});

describe('ordersView', () => {
	it('counts each tab and lists the chosen one, newest first', () => {
		const v = ordersView(w, 'open', '');
		expect(v.counts).toMatchObject({ open: 3, done: 1, closed: 1, unpaid: 4, all: 5 });
		expect(v.rows.map((r) => r.code)).toEqual(['HS-0002', 'HS-0003', 'HS-0001']);
	});
	it('searches every tab by name, phone or code', () => {
		expect(ordersView(w, 'open', 'besa').rows.map((r) => r.code)).toEqual(['HS-0002']);
		expect(ordersView(w, 'open', '222 333').rows.map((r) => r.code)).toEqual(['HS-0002']);
		expect(ordersView(w, 'open', 'hs-0005').rows.map((r) => r.code)).toEqual(['HS-0005']);
	});
});

describe('dashboardView', () => {
	it('splits unmade orders into can-make-now and waiting, oldest first', () => {
		const v = dashboardView(w, T0 + 100);
		expect(v.canMake.map((r) => r.code)).toEqual(['HS-0001']);
		expect(v.blocked.map((r) => [r.code, r.missing])).toEqual([
			['HS-0002', ['1 × Oversized 200gr · E zezë · M', '1 × Print DTF: Shqiponja · bluzë e zezë']]
		]);
		expect(v.waitingCourier).toBe(1);
		expect(v.deliveredUnpaid).toBe(2500);
		expect(v.toBuy).toBe(1);
		expect(v.toPrint).toEqual([{ label: 'Shqiponja · bluzë e zezë', short: 1 }]);
	});
});

describe('orderView', () => {
	it('shows what an unmade order is missing and what can happen next', () => {
		const v = orderView(w, 'b')!;
		expect(v.readiness).toEqual({ ready: false, customPending: 0, short: ['1 × Oversized 200gr · E zezë · M', '1 × Print DTF: Shqiponja · bluzë e zezë'] });
		expect(v.events).toEqual(['start', 'make', 'cancel']);
		expect(v.balance).toBe(5000);
		expect(orderView(w, 'nope')).toBeNull();
	});
	it('lists the customer’s other orders', () => expect(orderView(w, 'a')!.historyCount).toBe(3));
});

describe('shipmentsView', () => {
	it('sorts parcels by where they are', () => {
		const v = shipmentsView(w);
		expect(v.waiting.map((r) => r.code)).toEqual(['HS-0003']);
		expect(v.unpaid.map((r) => r.code)).toEqual(['HS-0004']);
	});
});

describe('stockView', () => {
	it('shows each size’s shelf and what to buy', () => {
		const v = stockView(w);
		const blackM = v.blanks.find((g) => g.color === 'black')!.sizes.find((s) => s.size === 'M')!;
		expect(blackM).toMatchObject({ have: 2, reserved: 3, short: 1 });
		expect(v.toBuy).toEqual([{ label: 'Oversized 200gr · E zezë · M', short: 1 }]);
	});
});

describe('customersView', () => {
	it('ranks customers by what they spent', () => {
		const v = customersView(w, '');
		expect(v.map((c) => [c.name, c.orders, c.spent])).toEqual([['Arta Krasniqi', 3, 7500], ['Besa', 1, 5000]]);
	});
});
