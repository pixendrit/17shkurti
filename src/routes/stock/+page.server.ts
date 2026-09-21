import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { blanks, designs, dtfStock } from '$lib/server/db/schema';
import { adjustStock, shoppingList } from '$lib/server/stock';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));

	const dtf = await db.select().from(dtfStock);
	const list = await shoppingList();

	return {
		blanks: await db
			.select()
			.from(blanks)
			.orderBy(asc(blanks.productType), asc(blanks.color), asc(blanks.size)),
		dtf: dtf.map((d) => ({ ...d, designName: designName.get(d.designId) ?? 'Unknown' })),
		designs: allDesigns.filter((d) => !d.archived),
		toBuy: list.blanks,
		toPrint: list.transfers.map((t) => ({ ...t, designName: designName.get(t.designId) ?? 'Unknown' }))
	};
};

export const actions: Actions = {
	adjust: async ({ request }) => {
		const f = await request.formData();
		const kind = String(f.get('kind')) as 'blank' | 'dtf';
		const refId = Number(f.get('refId'));
		const delta = Number(f.get('delta'));
		if (!refId || !delta) return fail(400, { error: 'Nothing to change.' });
		await adjustStock(kind, refId, delta, String(f.get('reason') ?? 'Manual adjustment'));
		return { ok: true };
	},

	addBlank: async ({ request }) => {
		const f = await request.formData();
		const productType = String(f.get('productType') ?? '').trim();
		const color = String(f.get('color') ?? '').trim();
		const size = String(f.get('size') ?? '').trim();
		if (!productType || !color || !size) return fail(400, { error: 'Fill in all fields.' });

		const existing = await db.query.blanks.findFirst({
			where: (b, { and, eq: e }) =>
				and(e(b.productType, productType), e(b.color, color), e(b.size, size))
		});
		if (existing) return fail(400, { error: 'That blank already exists.' });

		await db.insert(blanks).values({
			productType,
			color,
			size,
			quantity: Number(f.get('quantity')) || 0,
			unitCost: Number(f.get('unitCost')) || 0
		});
		return { ok: true };
	},

	addDtf: async ({ request }) => {
		const f = await request.formData();
		const designId = Number(f.get('designId'));
		if (!designId) return fail(400, { error: 'Pick a design.' });

		const existing = await db.query.dtfStock.findFirst({ where: eq(dtfStock.designId, designId) });
		if (existing) return fail(400, { error: 'That design already has a stock row.' });

		await db.insert(dtfStock).values({
			designId,
			quantity: Number(f.get('quantity')) || 0,
			unitCost: Number(f.get('unitCost')) || 0
		});
		return { ok: true };
	},

	/** Record that transfers have been sent to the print shop. */
	setOnOrder: async ({ request }) => {
		const f = await request.formData();
		await db
			.update(dtfStock)
			.set({ onOrder: Math.max(0, Number(f.get('onOrder')) || 0) })
			.where(eq(dtfStock.id, Number(f.get('id'))));
		return { ok: true };
	},

	/** Transfers arrived: move them from on-order into real stock. */
	receiveDtf: async ({ request }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		const row = await db.query.dtfStock.findFirst({ where: eq(dtfStock.id, id) });
		if (!row || row.onOrder <= 0) return fail(400, { error: 'Nothing on order.' });

		await adjustStock('dtf', id, row.onOrder, 'Print order received');
		await db.update(dtfStock).set({ onOrder: 0 }).where(eq(dtfStock.id, id));
		return { ok: true };
	}
};
