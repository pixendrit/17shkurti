import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { expenses, orders } from '$lib/data/schema';
import {
	createOrder,
	existingTrackingRefs,
	type ImportFields,
	type ItemImages,
	type NewOrderInput
} from '$lib/server/create-order';
import type { RequestHandler } from './$types';

type ImportBody = {
	orders?: { input: NewOrderInput; images?: ItemImages; extra?: ImportFields }[];
	expenses?: { date: number; category: string; description?: string; quantity?: number; amount: number; isDemo?: boolean }[];
};

/**
 * Bulk import: history from before the app (courier exports) and demo data.
 * Goes through the same createOrder as the app, so costs are worked out the
 * same way. A parcel whose courier reference is already stored is skipped,
 * so running an import twice never duplicates it.
 */
export const POST: RequestHandler = async ({ request, locals: { db } }) => {
	const body = (await request.json()) as ImportBody;
	const seen = await existingTrackingRefs(db);
	// Demo data is added once; re-running an import must not double it.
	const [anyDemo] = await db.select({ id: orders.id }).from(orders).where(eq(orders.isDemo, true)).limit(1);
	const skipDemo = !!anyDemo;
	let created = 0;
	let skipped = 0;
	const errors: string[] = [];

	for (const o of body.orders ?? []) {
		const ref = o.input.trackingRef?.trim();
		if ((ref && seen.has(ref)) || (skipDemo && o.extra?.isDemo)) {
			skipped++;
			continue;
		}
		const res = await createOrder(db, o.input, o.images ?? {}, o.extra ?? {});
		if ('error' in res) errors.push(`${o.input.customerName}: ${res.error}`);
		else {
			created++;
			if (ref) seen.add(ref);
		}
	}

	let expensesAdded = 0;
	for (const x of body.expenses ?? []) {
		if (!(x.amount > 0) || (skipDemo && x.isDemo)) continue;
		await db.insert(expenses).values({
			date: x.date,
			category: x.category,
			description: x.description ?? null,
			quantity: x.quantity ?? null,
			amount: x.amount,
			isDemo: x.isDemo ?? false
		});
		expensesAdded++;
	}

	return json({ created, skipped, expensesAdded, errors });
};
