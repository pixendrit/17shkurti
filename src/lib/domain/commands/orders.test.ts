import { describe, expect, it } from 'vitest';
import type { Change, Movement, World } from '../model';
import { onHand } from '../stock';
import { apply } from '../world';
import { context, customer, line, order, sku, T0, world } from '../testing';
import {
	advance,
	advanceMany,
	createOrder,
	deleteOrder,
	editOrder,
	recordPayment,
	settle,
	setPrintReady,
	type NewOrder
} from './orders';
import type { Result } from '../result';

const png = { mime: 'image/png' as const, data: 'iVBORw0KGgo=' };

const input = (over: Partial<NewOrder> = {}): NewOrder => ({
	customer: { name: 'Blerina Hoxha', phone: '+383 49 555 666', address: 'Rr. B', city: 'Pejë', country: 'XK' },
	kind: 'sale',
	channel: 'instagram',
	delivery: { method: 'courier', cost: null, trackingRef: '' },
	lines: [{ sku: sku(), artwork: { kind: 'design', designId: 'D1' }, quantity: 2, unitPrice: 2500 }],
	shippingCharged: 0,
	discount: 0,
	notes: '',
	paidWith: null,
	...over
});

/** The world after a command, or the command's error. */
function run(w: World, r: Result<Change[]>): World {
	if (!r.ok) throw new Error(r.error);
	return apply(w, r.value);
}

const stock = (subject: Movement['subject'], delta: number): Movement => ({
	id: `s-${JSON.stringify(subject)}`,
	subject,
	delta,
	reason: 'purchase',
	note: '',
	orderId: null,
	purchaseId: null,
	at: T0
});
const blackM = { kind: 'blank' as const, sku: sku() };
const printB = { kind: 'print' as const, printId: 'P-black' };

describe('createOrder', () => {
	it('takes an order: a new customer, the print for the shirt colour, today’s costs', () => {
		const w = run(world(), createOrder(world(), input(), context()));
		expect(w.customers).toHaveLength(2);
		const o = w.orders[0];
		expect(o).toMatchObject({
			code: 'HS-0001',
			status: 'new',
			delivery: { method: 'courier', cost: 250 },
			packaging: 12,
			stockTracked: true,
			createdAt: T0
		});
		expect(o.lines[0]).toMatchObject({
			artwork: { kind: 'print', printId: 'P-black' },
			quantity: 2,
			cost: { blank: 800, dtf: 300, labor: 200 }
		});
	});

	it('uses the white print on a white shirt', () => {
		const w = run(world(), createOrder(world(), input({ lines: [{ ...input().lines[0], sku: sku({ color: 'white' }) }] }), context()));
		expect(w.orders[0].lines[0].artwork).toEqual({ kind: 'print', printId: 'P-white' });
	});

	it('finds a returning customer by phone and updates their address', () => {
		const w0 = world({ customers: [customer({ phone: '0038349555666', address: 'old' })] });
		const w = run(w0, createOrder(w0, input(), context()));
		expect(w.customers).toHaveLength(1);
		expect(w.customers[0]).toMatchObject({ id: 'C1', address: 'Rr. B', name: 'Blerina Hoxha' });
		expect(w.orders[0].customerId).toBe('C1');
	});

	it('charges the courier price for the country; nothing for a hand delivery', () => {
		const al = input({ customer: { ...input().customer, country: 'AL' } });
		expect(run(world(), createOrder(world(), al, context())).orders[0].delivery.cost).toBe(500);
		const hand = input({ delivery: { method: 'hand', cost: null, trackingRef: '' } });
		expect(run(world(), createOrder(world(), hand, context())).orders[0].delivery).toEqual({ method: 'hand', cost: 0 });
	});

	it('records the payment when paid up front', () => {
		const w = run(world(), createOrder(world(), input({ paidWith: 'bank', discount: 500 }), context()));
		expect(w.payments).toEqual([expect.objectContaining({ amount: 4500, method: 'bank', orderId: w.orders[0].id })]);
	});

	it('a gift has no price and no payment', () => {
		const w = run(world(), createOrder(world(), input({ kind: 'gift', paidWith: 'cash', lines: [{ ...input().lines[0], unitPrice: 0 }] }), context()));
		expect(w.orders[0].lines[0].unitPrice).toBe(0);
		expect(w.payments).toEqual([]);
	});

	it('a personalised shirt stores both mockups and waits for its print', () => {
		const r = createOrder(world(), input({ lines: [{ sku: sku(), artwork: { kind: 'custom', front: png, back: png }, quantity: 1, unitPrice: 3000 }] }), context());
		expect(r.ok && r.value.filter((c) => 'put' in c && c.put === 'image')).toHaveLength(2);
		const w = run(world(), r);
		expect(w.orders[0].lines[0].artwork).toMatchObject({ kind: 'custom', printReady: false });
	});

	it.each<[string, Partial<NewOrder>, RegExp]>([
		['no name', { customer: { ...input().customer, name: ' ' } }, /Emri/],
		['no phone', { customer: { ...input().customer, phone: '' } }, /telefonit/],
		['no lines', { lines: [] }, /të paktën një/],
		['no price', { lines: [{ ...input().lines[0], unitPrice: 0 }] }, /çmimin/],
		['half a shirt', { lines: [{ ...input().lines[0], quantity: 1.5 }] }, /sasia/],
		['a mockup missing', { lines: [{ sku: sku(), artwork: { kind: 'custom', front: png, back: null }, quantity: 1, unitPrice: 3000 }] }, /mockup/],
		['a design with no print for the colour', { lines: [{ ...input().lines[0], artwork: { kind: 'design', designId: 'D2' } }] }, /nuk u gjet/],
		['a discount bigger than the order', { discount: 6000 }, /Zbritja/]
	])('refuses %s', (_, over, error) => {
		const r = createOrder(world(), input(over), context());
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(error);
	});

	it('refuses a design that has no print for the shirt colour', () => {
		const w = world({ prints: [world().prints[0]] }); // black only
		const r = createOrder(w, input({ lines: [{ ...input().lines[0], sku: sku({ color: 'white' }) }] }), context());
		expect(r).toEqual({ ok: false, error: 'Artikulli 1: „Shqiponja” nuk ka print për bluzë e bardhë.' });
	});

	it('numbers orders one after another', () => {
		const w1 = run(world(), createOrder(world(), input(), context()));
		const w2 = run(w1, createOrder(w1, input(), context(T0, 'b')));
		expect(w2.orders.map((o) => o.code)).toEqual(['HS-0001', 'HS-0002']);
	});
});

describe('advance: making takes stock', () => {
	const o = order({ lines: [line({ quantity: 2 })] });

	it('refuses to make an order the shelf can’t cover, and says what is missing', () => {
		const w = world({ orders: [o], movements: [stock(blackM, 1), stock(printB, 5)] });
		expect(advance(w, { orderId: 'O1', event: 'make' }, context())).toEqual({
			ok: false,
			error: 'HS-0001: mungon 1 × Oversized 200gr · E zezë · M.'
		});
	});

	it('takes the blanks and prints when it is made, and gives them back on undo', () => {
		const w0 = world({ orders: [o], movements: [stock(blackM, 3), stock(printB, 2)] });
		const w1 = run(w0, advance(w0, { orderId: 'O1', event: 'make' }, context()));
		expect(w1.orders[0]).toMatchObject({ status: 'ready', madeAt: T0 });
		expect(onHand(w1.movements).get('blank:oversized_200g/black/M')).toBe(1);
		expect(onHand(w1.movements).get('print:P-black')).toBe(0);

		const w2 = run(w1, advance(w1, { orderId: 'O1', event: 'undo' }, context(T0, 'u')));
		expect(w2.orders[0]).toMatchObject({ status: 'in_production', madeAt: null });
		expect(onHand(w2.movements).get('blank:oversized_200g/black/M')).toBe(3);
		expect(onHand(w2.movements).get('print:P-black')).toBe(2);
	});

	it('makes an untracked (historic) order without touching stock', () => {
		const w = world({ orders: [{ ...o, stockTracked: false }] });
		const r = advance(w, { orderId: 'O1', event: 'make' }, context());
		expect(r.ok && r.value).toEqual([{ put: 'order', value: expect.objectContaining({ status: 'ready' }) }]);
	});

	it('waits for a personalised print', () => {
		const custom = order({ lines: [line({ id: 'c', artwork: { kind: 'custom', front: 'f', back: 'b', printReady: false } })] });
		const w = world({ orders: [custom], movements: [stock(blackM, 1)] });
		expect(advance(w, { orderId: 'O1', event: 'make' }, context())).toMatchObject({ ok: false, error: expect.stringMatching(/personalizuar/) });
		const w1 = run(w, setPrintReady(w, { orderId: 'O1', lineId: 'c', ready: true }, context()));
		expect(advance(w1, { orderId: 'O1', event: 'make' }, context()).ok).toBe(true);
	});

	it('refuses an event that can’t happen now', () =>
		expect(advance(world({ orders: [o] }), { orderId: 'O1', event: 'deliver' }, context())).toEqual({
			ok: false,
			error: 'HS-0001: „U dorëzua” nuk bëhet dot tani.'
		}));
});

describe('advanceMany', () => {
	it('hands several parcels to the courier at once', () => {
		const w0 = world({ orders: [order({ id: 'a', status: 'ready' }), order({ id: 'b', status: 'ready' })] });
		const w = run(w0, advanceMany(w0, { orderIds: ['a', 'b'], event: 'hand_over' }, context()));
		expect(w.orders.map((o) => o.status)).toEqual(['with_courier', 'with_courier']);
	});
	it('does none if one can’t — two orders can’t both take the last shirt', () => {
		const w0 = world({
			orders: [order({ id: 'a', code: 'HS-0001' }), order({ id: 'b', code: 'HS-0002' })],
			movements: [stock(blackM, 1), stock(printB, 1)]
		});
		const r = advanceMany(w0, { orderIds: ['a', 'b'], event: 'make' }, context());
		expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/^HS-0002: mungon/) });
	});
});

describe('payments', () => {
	const w0 = world({ orders: [order()] });

	it('records what is owed when no amount is given', () => {
		const w = run(w0, recordPayment(w0, { orderId: 'O1', amount: null, method: 'cod', receivedAt: null }, context()));
		expect(w.payments).toEqual([{ id: 'id1', orderId: 'O1', amount: 2500, method: 'cod', receivedAt: T0 }]);
		expect(recordPayment(w, { orderId: 'O1', amount: null, method: 'cod', receivedAt: null }, context()).ok).toBe(false);
	});

	it('takes part payments, but not more than is owed', () => {
		const w = run(w0, recordPayment(w0, { orderId: 'O1', amount: 1000, method: 'cash', receivedAt: null }, context()));
		expect(recordPayment(w, { orderId: 'O1', amount: 2000, method: 'cash', receivedAt: null }, context())).toMatchObject({ ok: false });
		expect(recordPayment(w, { orderId: 'O1', amount: 1500, method: 'cash', receivedAt: null }, context()).ok).toBe(true);
	});

	it('settles a courier payout, passing over what is already paid', () => {
		const w1 = world({ orders: [order({ id: 'a' }), order({ id: 'b' })], payments: [{ id: 'p', orderId: 'b', amount: 2500, method: 'bank', receivedAt: T0 }] });
		const r = settle(w1, { orderIds: ['a', 'b'], method: 'cod' }, context());
		expect(r.ok && r.value).toEqual([{ put: 'payment', value: expect.objectContaining({ orderId: 'a', amount: 2500 }) }]);
	});
});

describe('editOrder', () => {
	const edit = {
		customer: { name: 'Arta K.', phone: '+38344111222', address: 'Rr. e re', city: 'Prizren', country: 'XK' as const },
		kind: 'sale' as const,
		channel: 'tiktok' as const,
		delivery: { method: 'courier' as const, cost: 300, trackingRef: 'AB123' },
		shippingCharged: 0,
		discount: 0,
		notes: ' fix '
	};

	it('corrects the details and the customer, keeping the shirts', () => {
		const w0 = world({ orders: [order()] });
		const w = run(w0, editOrder(w0, { orderId: 'O1', edit }, context()));
		expect(w.orders[0]).toMatchObject({ channel: 'tiktok', delivery: { cost: 300, trackingRef: 'AB123' }, notes: 'fix', lines: order().lines });
		expect(w.customers).toEqual([customer({ name: 'Arta K.', address: 'Rr. e re', city: 'Prizren' })]);
	});

	it('won’t switch to hand delivery once the parcel left', () => {
		const w0 = world({ orders: [order({ status: 'with_courier', handedOverAt: T0 })] });
		const r = editOrder(w0, { orderId: 'O1', edit: { ...edit, delivery: { method: 'hand', cost: 0, trackingRef: '' } } }, context());
		expect(r.ok).toBe(false);
	});
});

describe('deleteOrder', () => {
	it('takes its payments and stock movements with it', () => {
		const w0 = world({ orders: [order({ lines: [line()] })], movements: [stock(blackM, 1), stock(printB, 1)] });
		const w1 = run(w0, advance(w0, { orderId: 'O1', event: 'make' }, context()));
		const w2 = run(w1, recordPayment(w1, { orderId: 'O1', amount: null, method: 'cash', receivedAt: null }, context(T0 + 1, 'p')));
		const w3 = run(w2, deleteOrder(w2, 'O1', context()));
		expect(w3.orders).toEqual([]);
		expect(w3.payments).toEqual([]);
		expect(onHand(w3.movements).get('blank:oversized_200g/black/M')).toBe(1);
	});
});
