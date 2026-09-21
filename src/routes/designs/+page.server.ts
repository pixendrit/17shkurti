import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { designs, dtfStock } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db.select().from(designs).orderBy(asc(designs.name));
	const stock = await db.select().from(dtfStock);
	const byDesign = new Map(stock.map((s) => [s.designId, s]));

	return {
		designs: rows.map((d) => ({
			...d,
			transfers: byDesign.get(d.id)?.quantity ?? 0,
			tracked: byDesign.has(d.id)
		}))
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Give the design a name.' });

		const [design] = await db
			.insert(designs)
			.values({ name, notes: String(f.get('notes') ?? '').trim() || null })
			.returning();

		// Start tracking transfer stock straight away, at zero.
		await db.insert(dtfStock).values({ designId: design.id, quantity: 0 });
		return { ok: true };
	},

	archive: async ({ request }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		const current = await db.query.designs.findFirst({ where: eq(designs.id, id) });
		if (!current) return fail(404, { error: 'Design not found.' });

		await db.update(designs).set({ archived: !current.archived }).where(eq(designs.id, id));
		return { ok: true };
	}
};
