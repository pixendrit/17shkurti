import { describe, expect, it } from 'vitest';
import { addScreenshots, advance, createDraft, createOrder, deleteDraft, deleteOrder, editLines, recordPayment, removeScreenshot, setPrintReady } from '$lib/domain/commands/orders';
import { createDesign, setPrintImage } from '$lib/domain/commands/catalog';
import { clearDemo, countStock, deletePurchase, recordPurchase, saveSettings } from '$lib/domain/commands/stock';
import { DEFAULT_SETTINGS, emptyWorld, type Change, type World } from '$lib/domain/model';
import type { Result } from '$lib/domain/result';
import { blank } from '$lib/domain/stock';
import { context, sku, T0 } from '$lib/domain/testing';
import { apply } from '$lib/domain/world';
import { commit, getImage, loadWorld, statements } from './repo';
import { asD1, sqliteD1 } from './sqlite-d1';

const png = { mime: 'image/png' as const, data: 'iVBORw0KGgo=' };

/**
 * The repository is right when writing changes and reading back gives the
 * same world as applying them in memory.
 */
async function roundTrip(db: D1Database, before: World, r: Result<Change[]>): Promise<World> {
	if (!r.ok) throw new Error(r.error);
	await commit(db, r.value);
	const after = await loadWorld(db);
	expect(after).toEqual(sortLike(after, apply(before, r.value)));
	return after;
}

/** The database returns rows in its own order; compare as sets. */
function sortLike(actual: World, expected: World): World {
	const order = <T extends { id: string }>(a: T[], e: T[]) => a.map((x) => e.find((y) => y.id === x.id) ?? x);
	return {
		...expected,
		customers: order(actual.customers, expected.customers),
		designs: order(actual.designs, expected.designs),
		prints: order(actual.prints, expected.prints),
		orders: order(actual.orders, expected.orders),
		payments: order(actual.payments, expected.payments),
		purchases: order(actual.purchases, expected.purchases),
		movements: order(actual.movements, expected.movements),
		drafts: order(actual.drafts, expected.drafts)
	};
}

describe('repository', () => {
	it('starts with the default settings and nothing else', async () => {
		const db = asD1(sqliteD1().migrate());
		expect(await loadWorld(db)).toEqual(emptyWorld());
	});

	it('writes and reads back a whole shop’s life', async () => {
		const db = asD1(sqliteD1().migrate());
		let w = await loadWorld(db);
		let n = 0;
		const ctx = (dt = 0) => context(T0 + dt, `c${++n}-`);

		w = await roundTrip(db, w, createDesign(w, { name: 'Shqiponja', notes: '', colors: ['black', 'white'], perSheet: 4 }, ctx()));
		const black = w.prints.find((p) => p.shirtColor === 'black')!;
		w = await roundTrip(db, w, setPrintImage(w, { printId: black.id, side: 'front', image: png }, ctx()));
		w = await roundTrip(db, w, setPrintImage(w, { printId: black.id, side: 'front', image: png }, ctx())); // replaces
		expect(await getImage(db, w.prints.find((p) => p.id === black.id)!.front!)).toMatchObject({ mime: 'image/png' });

		w = await roundTrip(db, w, recordPurchase(w, { kind: 'blanks', date: T0, note: 'Bluza', lines: [{ sku: sku(), quantity: 5, unitCost: 750 }] }, ctx()));
		w = await roundTrip(db, w, recordPurchase(w, { kind: 'dtf', date: T0, note: '', sheets: 1, sheetPrice: 1200, lines: [{ printId: black.id, quantity: 4 }] }, ctx()));
		w = await roundTrip(db, w, recordPurchase(w, { kind: 'expense', date: T0, note: 'Qese', category: 'packaging', amount: 600 }, ctx()));

		const input = {
			customer: { name: 'Arta', phone: '044 111 222', address: 'Rr. A', city: 'Prishtinë', country: 'XK' as const },
			kind: 'sale' as const,
			channel: 'instagram' as const,
			delivery: { method: 'courier' as const, cost: null, trackingRef: '' },
			lines: [
				{ sku: sku(), artwork: { kind: 'design' as const, designId: w.designs[0].id }, quantity: 2, unitPrice: 2500 },
				{ sku: sku({ size: 'L' }), artwork: { kind: 'custom' as const, front: png, back: png }, quantity: 1, unitPrice: 3000 }
			],
			shippingCharged: 0,
			discount: 0,
			notes: 'dy bluza',
			paidWith: null,
			screenshots: [png],
			fromDraft: null as string | null
		};
		// Caught in a hurry first, completed later.
		w = await roundTrip(db, w, createDraft(w, { name: 'Arta', phone: '', note: 'e zezë M', screenshots: [png, png] }, ctx(30)));
		expect(w.drafts[0].screenshots).toHaveLength(2);
		w = await roundTrip(db, w, createOrder(w, { ...input, fromDraft: w.drafts[0].id }, ctx(60)));
		expect(w.drafts).toEqual([]);
		const o = w.orders[0];
		expect(o.lines).toHaveLength(2);
		expect(o.screenshots).toHaveLength(3);
		w = await roundTrip(db, w, removeScreenshot(w, { orderId: o.id, imageId: o.screenshots[0] }, ctx()));
		w = await roundTrip(db, w, addScreenshots(w, { orderId: o.id, uploads: [png] }, ctx()));
		expect(w.orders[0].screenshots).toHaveLength(3);
		// A size changed and a plain shirt added before it's made.
		const [l1, l2] = w.orders[0].lines;
		w = await roundTrip(db, w, editLines(w, { orderId: o.id, lines: [
			{ id: l1.id, sku: sku(), artwork: { kind: 'design', designId: w.designs[0].id }, quantity: 2, unitPrice: 2500 },
			{ id: l2.id, sku: sku({ size: 'L' }), artwork: { kind: 'custom', front: null, back: null }, quantity: 1, unitPrice: 3000 }
		] }, ctx()));
		expect(w.orders[0].lines.map((l) => l.id)).toEqual([l1.id, l2.id]);
		const d2 = await roundTrip(db, w, createDraft(w, { name: '', phone: '', note: 'do të vijë', screenshots: [png] }, ctx()));
		w = await roundTrip(db, d2, deleteDraft(d2, d2.drafts[0].id, ctx()));

		w = await roundTrip(db, w, setPrintReady(w, { orderId: o.id, lineId: o.lines[1].id, ready: true }, ctx()));
		w = await roundTrip(db, w, countStock(w, { subject: blank(sku({ size: 'L' })), count: 1, note: 'numërim' }, ctx()));
		w = await roundTrip(db, w, advance(w, { orderId: o.id, event: 'make' }, ctx(120)));
		w = await roundTrip(db, w, advance(w, { orderId: o.id, event: 'hand_over' }, ctx(180)));
		w = await roundTrip(db, w, advance(w, { orderId: o.id, event: 'deliver' }, ctx(240)));
		w = await roundTrip(db, w, recordPayment(w, { orderId: o.id, amount: null, method: 'cod', receivedAt: null }, ctx(300)));
		w = await roundTrip(db, w, saveSettings(w, { ...DEFAULT_SETTINGS, sheetPrice: 1300, courierCost: { ...DEFAULT_SETTINGS.courierCost, AL: 450 } }, ctx()));

		expect(w.orders[0]).toMatchObject({ status: 'delivered', delivery: { cost: 250 } });
		expect(w.payments[0].amount).toBe(8000);

		// Deleting the purchase that the order used is refused; the order can go.
		expect(deletePurchase(w, w.purchases[0].id, ctx()).ok).toBe(false);
		w = await roundTrip(db, w, deleteOrder(w, o.id, ctx()));
		expect(w.orders).toEqual([]);
		w = await roundTrip(db, w, deletePurchase(w, w.purchases[0].id, ctx()));

		// Every picture still stored is still used by something.
		const orphans = await db
			.prepare(
				`SELECT COUNT(*) AS n FROM images WHERE id NOT IN (
					SELECT front_image_id FROM prints WHERE front_image_id IS NOT NULL UNION SELECT back_image_id FROM prints WHERE back_image_id IS NOT NULL
					UNION SELECT front_image_id FROM order_lines WHERE front_image_id IS NOT NULL UNION SELECT back_image_id FROM order_lines WHERE back_image_id IS NOT NULL
					UNION SELECT image_id FROM order_screenshots UNION SELECT image_id FROM draft_screenshots)`
			)
			.first<{ n: number }>();
		expect(orphans?.n).toBe(0);
	});

	it('refuses what the schema forbids, writing nothing', async () => {
		const db = asD1(sqliteD1().migrate());
		const w = await loadWorld(db);
		const bad: Change[] = [
			{ put: 'design', value: { id: 'd', name: 'X', notes: '', archived: false, createdAt: T0 } },
			// a shirt quantity of 0 breaks CHECK (quantity >= 1) — and the order points at no customer
			{ put: 'movement', value: { id: 'm', subject: blank(sku()), delta: 0, reason: 'adjustment', note: '', orderId: null, purchaseId: null, at: T0 } }
		];
		await expect(commit(db, bad)).rejects.toThrow();
		expect(await loadWorld(db)).toEqual(w);
	});

	it('clears a lot of sample data in few statements', async () => {
		const db = asD1(sqliteD1().migrate());
		let w = await loadWorld(db);
		const changes: Change[] = [];
		const ctx = context(T0, 'x');
		for (let i = 0; i < 120; i++) {
			const r = recordPurchase(w, { kind: 'blanks', date: T0, note: '', lines: [{ sku: sku(), quantity: 1, unitCost: 800 }] }, ctx);
			if (!r.ok) throw new Error(r.error);
			changes.push(...r.value);
			w = apply(w, r.value);
		}
		await commit(db, changes);
		w = { ...w, purchases: w.purchases.map((p) => ({ ...p, isDemo: true })) };
		await commit(db, w.purchases.map((p): Change => ({ put: 'purchase', value: p })));
		const r = clearDemo(await loadWorld(db), null, context());
		if (!r.ok) throw new Error(r.error);
		expect(statements(r.value).length).toBeLessThan(10);
		await commit(db, r.value);
		expect((await loadWorld(db)).purchases).toEqual([]);
	});
});
