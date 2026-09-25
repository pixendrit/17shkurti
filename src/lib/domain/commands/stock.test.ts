import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Change, type World } from '../model';
import type { Result } from '../result';
import { blank, onHand, printSubject } from '../stock';
import { apply } from '../world';
import { context, customer, order, sku, T0, world } from '../testing';
import { advance } from './orders';
import { purchaseTotal } from '../economics';
import { clearDemo, countStock, deletePurchase, recordPurchase, saveSettings } from './stock';

const run = (w: World, r: Result<Change[]>) => {
	if (!r.ok) throw new Error(r.error);
	return apply(w, r.value);
};
const blackM = 'blank:oversized_200g/black/M';

describe('recordPurchase', () => {
	it('blanks bought go on the shelf, at what they cost', () => {
		const w = run(
			world(),
			recordPurchase(world(), { kind: 'blanks', date: T0, note: '', lines: [{ sku: sku(), quantity: 10, unitCost: 800 }, { sku: sku({ size: 'L' }), quantity: 0, unitCost: 800 }] }, context())
		);
		expect(w.purchases).toHaveLength(1);
		expect(w.purchases[0].kind === 'blanks' && w.purchases[0].lines).toHaveLength(1);
		expect(purchaseTotal(w.purchases[0])).toBe(8000);
		expect(onHand(w.movements).get(blackM)).toBe(10);
	});

	it('a DTF sheet costs the sheet, and puts its prints on the shelf', () => {
		const w = run(world(), recordPurchase(world(), { kind: 'dtf', date: T0, note: '', sheets: 2, sheetPrice: 1200, lines: [{ printId: 'P-black', quantity: 8 }] }, context()));
		expect(purchaseTotal(w.purchases[0])).toBe(2400);
		expect(onHand(w.movements).get('print:P-black')).toBe(8);
	});

	it('an expense is just money out', () => {
		const w = run(world(), recordPurchase(world(), { kind: 'expense', date: T0, note: 'Reklamë', category: 'marketing', amount: 3000 }, context()));
		expect(purchaseTotal(w.purchases[0])).toBe(3000);
		expect(w.movements).toEqual([]);
	});

	it.each([
		[{ kind: 'blanks', lines: [] }, /copë/],
		[{ kind: 'blanks', lines: [{ sku: sku(), quantity: 2, unitCost: 0 }] }, /çmimin/],
		[{ kind: 'dtf', sheets: 0, sheetPrice: 1200, lines: [] }, /fletë/],
		[{ kind: 'dtf', sheets: 1, sheetPrice: 1200, lines: [{ printId: 'nope', quantity: 2 }] }, /Printi/],
		[{ kind: 'expense', category: 'marketing', amount: 0 }, /shumën/]
	] as const)('refuses %j', (p, error) => {
		const r = recordPurchase(world(), { date: T0, note: "", ...(p as object) } as never, context());
		expect(!r.ok && r.error).toMatch(error);
	});
});

describe('deletePurchase', () => {
	const bought = run(world(), recordPurchase(world(), { kind: 'blanks', date: T0, note: '', lines: [{ sku: sku(), quantity: 1, unitCost: 800 }] }, context(T0, 'b')));
	it('takes its stock off the shelf again', () => {
		const w = run(bought, deletePurchase(bought, bought.purchases[0].id, context()));
		expect(w.purchases).toEqual([]);
		expect(onHand(w.movements).get(blackM) ?? 0).toBe(0);
	});
	it('refuses once that stock was used', () => {
		const w0 = { ...bought, orders: [order({ lines: [{ ...order().lines[0], artwork: { kind: 'none' } }] })] };
		const w1 = run(w0, advance(w0, { orderId: 'O1', event: 'make' }, context()));
		expect(deletePurchase(w1, w1.purchases[0].id, context())).toMatchObject({ ok: false, error: expect.stringMatching(/përdorur/) });
	});
});

describe('countStock', () => {
	it('records the difference from what was counted', () => {
		const w1 = run(world(), countStock(world(), { subject: blank(sku()), count: 7, note: 'numërim' }, context()));
		expect(w1.movements[0]).toMatchObject({ delta: 7, reason: 'adjustment', note: 'numërim' });
		const w2 = run(w1, countStock(w1, { subject: blank(sku()), count: 5, note: '' }, context(T0, 'c')));
		expect(onHand(w2.movements).get(blackM)).toBe(5);
		expect(countStock(w2, { subject: blank(sku()), count: 5, note: '' }, context())).toEqual({ ok: true, value: [] });
	});
	it('refuses a negative count or an unknown print', () => {
		expect(countStock(world(), { subject: blank(sku()), count: -1, note: '' }, context()).ok).toBe(false);
		expect(countStock(world(), { subject: printSubject('nope'), count: 1, note: '' }, context()).ok).toBe(false);
	});
});

describe('saveSettings', () => {
	it('accepts sensible prices', () => expect(saveSettings(world(), DEFAULT_SETTINGS, context()).ok).toBe(true));
	it('refuses negative or fractional cents', () => {
		expect(saveSettings(world(), { ...DEFAULT_SETTINGS, sheetPrice: -1 }, context()).ok).toBe(false);
		expect(saveSettings(world(), { ...DEFAULT_SETTINGS, laborPerShirt: 1.5 }, context()).ok).toBe(false);
		expect(saveSettings(world(), { ...DEFAULT_SETTINGS, customPerSheet: 0 }, context()).ok).toBe(false);
	});
});

describe('clearDemo', () => {
	it('removes sample customers left with no order, and keeps real ones', () => {
		const w0 = world({
			customers: [customer(), customer({ id: 'fake' })],
			orders: [order({ id: 'demo', isDemo: true, customerId: 'fake' }), order({ id: 'both', isDemo: true }), order({ id: 'real' })]
		});
		const w = run(w0, clearDemo(w0, null, context()));
		expect(w.customers.map((c) => c.id)).toEqual(['C1']);
		expect(w.orders.map((o) => o.id)).toEqual(['real']);
	});

	it('removes sample orders and purchases with what hangs off them, and nothing else', () => {
		const w0 = world({
			orders: [order({ id: 'demo', isDemo: true }), order({ id: 'real' })],
			payments: [
				{ id: 'pd', orderId: 'demo', amount: 1, method: 'cod', receivedAt: T0 },
				{ id: 'pr', orderId: 'real', amount: 1, method: 'cod', receivedAt: T0 }
			]
		});
		const w = run(w0, clearDemo(w0, null, context()));
		expect(w.orders.map((o) => o.id)).toEqual(['real']);
		expect(w.payments.map((p) => p.id)).toEqual(['pr']);
		expect(clearDemo(w, null, context()).ok).toBe(false);
	});
});
