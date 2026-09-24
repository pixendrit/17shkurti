import { describe, expect, it } from 'vitest';
import { nextStatus, possibleEvents, step } from './process';
import type { OrderEvent, Status } from './model';
import { order, T0 } from './testing';

const courier = (status: Status) => order({ status });
const hand = (status: Status) => order({ status, delivery: { method: 'hand', cost: 0 } });

describe('nextStatus: the transition table', () => {
	it.each<[Status, OrderEvent, Status | null]>([
		['new', 'start', 'in_production'],
		['new', 'make', 'ready'],
		['in_production', 'make', 'ready'],
		['in_production', 'start', null],
		['ready', 'hand_over', 'with_courier'],
		['ready', 'deliver', null], // a parcel must go through the courier
		['with_courier', 'deliver', 'delivered'],
		['with_courier', 'return', 'returned'],
		['with_courier', 'cancel', null], // already left
		['new', 'cancel', 'cancelled'],
		['ready', 'cancel', 'cancelled'],
		['delivered', 'return', null],
		['new', 'hand_over', null],
		['new', 'undo', null]
	])('courier order: %s --%s--> %s', (from, event, to) => expect(nextStatus(courier(from), event)).toBe(to));

	it('hand deliveries skip the courier', () => {
		expect(nextStatus(hand('ready'), 'hand_over')).toBeNull();
		expect(nextStatus(hand('ready'), 'deliver')).toBe('delivered');
	});
});

describe('step', () => {
	it('records when an order was made, handed over and delivered', () => {
		const made = step(order(), 'make', T0 + 10)!;
		expect(made).toMatchObject({ status: 'ready', madeAt: T0 + 10 });
		const sent = step(made, 'hand_over', T0 + 20)!;
		expect(sent).toMatchObject({ status: 'with_courier', handedOverAt: T0 + 20 });
		const done = step(sent, 'deliver', T0 + 30)!;
		expect(done).toMatchObject({ status: 'delivered', deliveredAt: T0 + 30, madeAt: T0 + 10 });
	});

	it('refuses what cannot happen', () => expect(step(order(), 'deliver', T0)).toBeNull());

	it('undo steps back and forgets the step', () => {
		const sent = order({ status: 'with_courier', madeAt: T0, handedOverAt: T0 + 5 });
		expect(step(sent, 'undo', T0 + 9)).toMatchObject({ status: 'ready', handedOverAt: null, madeAt: T0 });
		const delivered = order({ status: 'delivered', madeAt: T0, handedOverAt: T0, deliveredAt: T0 });
		expect(step(delivered, 'undo', T0)).toMatchObject({ status: 'with_courier', deliveredAt: null });
		const handDelivered = order({ status: 'delivered', madeAt: T0, deliveredAt: T0 });
		expect(step(handDelivered, 'undo', T0)?.status).toBe('ready');
		expect(step(order({ status: 'cancelled', madeAt: T0, cancelledAt: T0 }), 'undo', T0)?.status).toBe('ready');
		expect(step(order({ status: 'cancelled', cancelledAt: T0 }), 'undo', T0)?.status).toBe('new');
		expect(step(order({ status: 'ready', madeAt: T0 }), 'undo', T0)).toMatchObject({
			status: 'in_production',
			madeAt: null
		});
	});
});

describe('possibleEvents', () => {
	it('lists what can be done now', () => {
		expect(possibleEvents(order())).toEqual(['start', 'make', 'cancel']);
		expect(possibleEvents(courier('with_courier'))).toEqual(['deliver', 'return', 'undo']);
		expect(possibleEvents(hand('ready'))).toEqual(['deliver', 'cancel', 'undo']);
	});
});
