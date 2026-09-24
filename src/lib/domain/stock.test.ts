import { describe, expect, it } from 'vitest';
import type { Movement, Subject } from './model';
import { allocate, blank, needs, onHand, printSubject, shelf, shortfall, subjectKey } from './stock';
import { line, order, sku, T0 } from './testing';

const mv = (subject: Subject, delta: number, id = `m${Math.random()}`): Movement => ({
	id,
	subject,
	delta,
	reason: 'purchase',
	note: '',
	orderId: null,
	purchaseId: null,
	at: T0
});
const blackM = blank(sku());
const printB = printSubject('P-black');

describe('onHand', () => {
	it('sums each subject’s movements', () => {
		const have = onHand([mv(blackM, 5), mv(blackM, -2), mv(printB, 3)]);
		expect(have.get(subjectKey(blackM))).toBe(3);
		expect(have.get('print:P-black')).toBe(3);
		expect(have.get('print:other')).toBeUndefined();
	});
});

describe('needs', () => {
	it('takes a blank per shirt and a print per printed shirt', () => {
		const o = order({
			lines: [
				line({ id: 'a', quantity: 2 }),
				line({ id: 'b', quantity: 1, artwork: { kind: 'none' } }),
				line({ id: 'c', quantity: 1, sku: sku({ size: 'L' }), artwork: { kind: 'custom', front: 'f', back: 'b', printReady: true } })
			]
		});
		const n = needs(o);
		expect(n.get('blank:oversized_200g/black/M')?.quantity).toBe(3);
		expect(n.get('blank:oversized_200g/black/L')?.quantity).toBe(1);
		expect(n.get('print:P-black')?.quantity).toBe(2);
		expect(n.size).toBe(3);
	});
	it('takes nothing for an order made before the ledger', () =>
		expect(needs(order({ stockTracked: false })).size).toBe(0));
});

describe('shortfall', () => {
	it('is what the shelf lacks for this order', () => {
		const have = onHand([mv(blackM, 1)]);
		expect(shortfall(have, order({ lines: [line({ quantity: 2 })] }))).toEqual([
			{ subject: blackM, quantity: 1 },
			{ subject: printB, quantity: 2 }
		]);
	});
});

describe('allocate', () => {
	const older = order({ id: 'old', code: 'HS-0001', createdAt: T0 });
	const newer = order({ id: 'new', code: 'HS-0002', createdAt: T0 + 60 });

	it('gives the last shirt to the older order only', () => {
		const plan = allocate({ orders: [newer, older], movements: [mv(blackM, 1), mv(printB, 1)] });
		expect(plan.get('old')?.ready).toBe(true);
		expect(plan.get('new')).toEqual({
			ready: false,
			customPending: 0,
			short: [
				{ subject: blackM, quantity: 1 },
				{ subject: printB, quantity: 1 }
			]
		});
	});

	it('lets an older order keep what it has while it waits for the rest', () => {
		// The older order waits for a print; its blank is still not given away.
		const plan = allocate({ orders: [older, newer], movements: [mv(blackM, 1), mv(printB, 0)] });
		expect(plan.get('old')?.short).toEqual([{ subject: printB, quantity: 1 }]);
		expect(plan.get('new')?.short).toContainEqual({ subject: blackM, quantity: 1 });
	});

	it('waits for personalised prints', () => {
		const custom = order({
			lines: [line({ artwork: { kind: 'custom', front: 'f', back: 'b', printReady: false } })]
		});
		expect(allocate({ orders: [custom], movements: [mv(blackM, 1)] }).get('O1')).toEqual({
			short: [],
			customPending: 1,
			ready: false
		});
	});

	it('ignores orders already made', () =>
		expect(allocate({ orders: [order({ status: 'ready' })], movements: [] }).size).toBe(0));
});

describe('shelf', () => {
	it('shows what is there, what is wanted and what to buy', () => {
		const rows = shelf({
			orders: [order({ lines: [line({ quantity: 3 })] }), order({ id: 'x', status: 'delivered' })],
			movements: [mv(blackM, 1), mv(blank(sku({ color: 'white' })), 4)]
		});
		const by = Object.fromEntries(rows.map((r) => [r.key, r]));
		expect(by['blank:oversized_200g/black/M']).toMatchObject({ have: 1, reserved: 3, short: 2 });
		expect(by['print:P-black']).toMatchObject({ have: 0, reserved: 3, short: 3 });
		expect(by['blank:oversized_200g/white/M']).toMatchObject({ have: 4, reserved: 0, short: 0 });
	});
});
