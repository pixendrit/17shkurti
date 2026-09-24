import { desc, eq } from 'drizzle-orm';
import { designs, expenses } from '$lib/data/schema';
import { getSettings } from '$lib/data/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {
	const rows = await db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.id));

	// Group by month, newest first, with a total per category.
	const months = new Map<string, { total: number; byCategory: Record<string, number>; rows: typeof rows }>();
	for (const x of rows) {
		const d = new Date(x.date * 1000);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const m = months.get(key) ?? { total: 0, byCategory: {}, rows: [] };
		m.total += x.amount;
		m.byCategory[x.category] = (m.byCategory[x.category] ?? 0) + x.amount;
		m.rows.push(x);
		months.set(key, m);
	}

	return {
		months: [...months.entries()].map(([month, m]) => ({ month, ...m })),
		total: rows.reduce((a, x) => a + x.amount, 0),
		designs: await db.select().from(designs).where(eq(designs.archived, false)),
		settings: await getSettings(db)
	};
};
