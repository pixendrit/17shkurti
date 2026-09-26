import { describe, expect, it } from 'vitest';
import { dueFollowUp, fill, message, stageOf, whatsappNumber } from './followup';
import { customer, line, order, T0, world } from './testing';

describe('stageOf / dueFollowUp', () => {
	it('maps the order’s status to what the client should hear about', () => {
		expect(stageOf(order({ status: 'new' }))).toBeNull();
		expect(stageOf(order({ status: 'ready' }))).toBe('ready');
		expect(stageOf(order({ status: 'with_courier' }))).toBe('shipped');
		expect(stageOf(order({ status: 'delivered' }))).toBe('delivered');
		expect(stageOf(order({ status: 'cancelled' }))).toBeNull();
	});
	it('is due until the client has been told of the current step', () => {
		expect(dueFollowUp(order({ status: 'ready' }))).toBe('ready');
		expect(dueFollowUp(order({ status: 'ready', notified: { ready: T0 } }))).toBeNull();
		// Told it was ready, now it's shipped: that's due.
		expect(dueFollowUp(order({ status: 'with_courier', notified: { ready: T0 } }))).toBe('shipped');
	});
});

describe('fill', () => {
	it('replaces what it knows and leaves the rest', () =>
		expect(fill('Hi {emri}, {x}', { emri: 'Arta' })).toBe('Hi Arta, {x}'));
});

describe('message', () => {
	const w = world();
	it('says who, what and what is still to pay', () => {
		const o = order({ code: 'HS-0007', lines: [line({ quantity: 2 })], delivery: { method: 'courier', cost: 250, trackingRef: 'X123' } });
		const shipped = message(w, o, customer(), 'shipped');
		expect(shipped).toContain('Arta!');
		expect(shipped).toContain('HS-0007');
		expect(shipped).toContain('X123');
		expect(shipped).toContain('50 €');
		expect(message(w, o, customer(), 'ready')).toContain('2 × Shqiponja · Oversized 200gr · E zezë · M');
	});
	it('says paid once it is, and a gift is a gift', () => {
		const o = order();
		expect(message({ ...w, payments: [{ id: 'p', orderId: 'O1', amount: 2500, method: 'cash', receivedAt: T0 }] }, o, customer(), 'ready')).toContain('e paguar');
		expect(message(w, order({ kind: 'gift' }), customer(), 'ready')).toContain('dhuratë nga ne');
	});
});

describe('whatsappNumber', () => {
	it.each([
		['044 123 456', 'XK', '38344123456'],
		['+383 44 123 456', 'XK', '38344123456'],
		['0038344123456', 'AL', '38344123456'],
		['069 111 2233', 'AL', '355691112233'],
		['070 123 456', 'MK', '38970123456'],
		['—', 'XK', null],
		['0123', 'OTHER', null]
	] as const)('%s in %s -> %s', (phone, country, n) => expect(whatsappNumber(phone, country)).toBe(n));
});
