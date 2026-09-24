import { describe, expect, it } from 'vitest';
import { formOf, parseNewOrder, parseOrderEdit, parsePayment, parsePurchase, parseSettings, parseSubject } from './forms';
import { DEFAULT_SETTINGS } from './model';
import { T0 } from './testing';
import { parseDay } from './time';

const png = { mime: 'image/png' as const, data: 'AAAA' };

const order = (over: Record<string, string | string[]> = {}) =>
	formOf(
		{
			kind: 'sale',
			name: 'Arta',
			phone: '044 111 222',
			address: 'Rr. A',
			city: 'Prishtinë',
			country: 'AL',
			channel: 'messenger',
			delivery: 'courier',
			deliveryCost: '',
			trackingRef: '',
			shippingCharged: '',
			discount: '2,50',
			notes: '',
			paidWith: '',
			line: ['0', '3'],
			'garment-0': 'oversized_200g',
			'color-0': 'black',
			'size-0': 'L',
			'art-0': 'design:D1',
			'qty-0': '2',
			'price-0': '25',
			'garment-3': 'regular_fit',
			'color-3': 'white',
			'size-3': 'S',
			'art-3': 'custom',
			'qty-3': '1',
			'price-3': '30,50',
			...over
		},
		{ 'front-3': png, 'back-3': png }
	);

describe('parseNewOrder', () => {
	it('reads the whole form', () => {
		const r = parseNewOrder(order());
		expect(r).toEqual({
			ok: true,
			value: {
				customer: { name: 'Arta', phone: '044 111 222', address: 'Rr. A', city: 'Prishtinë', country: 'AL' },
				kind: 'sale',
				channel: 'messenger',
				delivery: { method: 'courier', cost: null, trackingRef: '' },
				lines: [
					{ sku: { garment: 'oversized_200g', color: 'black', size: 'L' }, artwork: { kind: 'design', designId: 'D1' }, quantity: 2, unitPrice: 2500 },
					{ sku: { garment: 'regular_fit', color: 'white', size: 'S' }, artwork: { kind: 'custom', front: png, back: png }, quantity: 1, unitPrice: 3050 }
				],
				shippingCharged: 0,
				discount: 250,
				notes: '',
				paidWith: null
			}
		});
	});
	it('reads a delivery cost typed over the usual one, and payment up front', () => {
		const r = parseNewOrder(order({ deliveryCost: '0', paidWith: 'bank' }));
		expect(r.ok && [r.value.delivery.cost, r.value.paidWith]).toEqual([0, 'bank']);
	});
	it.each([
		[{ 'qty-0': 'dy' }, /sasia/],
		[{ 'price-0': 'njëzet' }, /çmimi/],
		[{ 'size-0': 'XXXL' }, /masën/],
		[{ discount: '-1' }, /Zbritja/],
		[{ delivery: 'drone' }, /dërgesës/]
	])('says which field is wrong: %j', (over, error) => {
		const r = parseNewOrder(order(over));
		expect(!r.ok && r.error).toMatch(error);
	});
});

describe('parseOrderEdit', () => {
	it('reads the details', () => {
		const r = parseOrderEdit(order({ delivery: 'hand', deliveryCost: '1' }));
		expect(r.ok && r.value.delivery).toEqual({ method: 'hand', cost: 100, trackingRef: '' });
	});
});

describe('parsePayment', () => {
	it('empty amount means all that is owed, today', () =>
		expect(parsePayment(formOf({ amount: '', method: 'cod' }), T0)).toEqual({ ok: true, value: { amount: null, method: 'cod', receivedAt: T0 } }));
	it('reads an amount and a date', () =>
		expect(parsePayment(formOf({ amount: '10', method: 'cash', date: '2026-09-01' }), T0)).toEqual({
			ok: true,
			value: { amount: 1000, method: 'cash', receivedAt: parseDay('2026-09-01') }
		}));
});

describe('parsePurchase', () => {
	it('reads blanks by size, skipping empty sizes', () => {
		const r = parsePurchase(formOf({ kind: 'blanks', garment: 'oversized_200g', color: 'white', unitCost: '7,5', 'qty-M': '10', 'qty-L': '', 'qty-XL': '4' }), T0);
		expect(r.ok && r.value).toEqual({
			kind: 'blanks',
			date: T0,
			note: '',
			lines: [
				{ sku: { garment: 'oversized_200g', color: 'white', size: 'M' }, quantity: 10, unitCost: 750 },
				{ sku: { garment: 'oversized_200g', color: 'white', size: 'XL' }, quantity: 4, unitCost: 750 }
			]
		});
	});
	it('reads DTF sheets and their prints', () => {
		const r = parsePurchase(formOf({ kind: 'dtf', sheets: '2', sheetPrice: '12', print: ['a', 'b'], 'qty-a': '8', 'qty-b': '' }), T0);
		expect(r.ok && r.value).toMatchObject({ sheets: 2, sheetPrice: 1200, lines: [{ printId: 'a', quantity: 8 }] });
	});
	it('reads an expense', () =>
		expect(parsePurchase(formOf({ kind: 'expense', category: 'marketing', amount: '30', note: 'Reklamë' }), T0)).toMatchObject({
			ok: true,
			value: { kind: 'expense', category: 'marketing', amount: 3000, note: 'Reklamë' }
		}));
});

describe('parseSubject', () => {
	it('reads the two kinds of stock', () => {
		expect(parseSubject(formOf({ subject: 'blank:oversized_200g/black/M' }))).toEqual({
			ok: true,
			value: { kind: 'blank', sku: { garment: 'oversized_200g', color: 'black', size: 'M' } }
		});
		expect(parseSubject(formOf({ subject: 'print:abc' }))).toEqual({ ok: true, value: { kind: 'print', printId: 'abc' } });
		expect(parseSubject(formOf({ subject: 'blank:hat/red/M' })).ok).toBe(false);
	});
});

describe('parseSettings', () => {
	it('reads euro amounts as cents', () => {
		const f = formOf({
			defaultPrice: '25',
			sheetPrice: '12',
			laborPerShirt: '2',
			packagingPerOrder: '0,12',
			customPerSheet: '4',
			'blank-oversized_200g': '8',
			'blank-regular_fit': '8',
			'courier-XK': '2,50',
			'courier-AL': '5',
			'courier-MK': '5',
			'courier-OTHER': '5'
		});
		expect(parseSettings(f)).toEqual({ ok: true, value: DEFAULT_SETTINGS });
	});
});
