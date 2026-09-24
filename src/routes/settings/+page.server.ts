import { eq, sql } from 'drizzle-orm';
import { designs, expenses, orders } from '$lib/data/schema';
import { getSettings } from '$lib/data/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {
	const [demoOrders] = await db.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.isDemo, true));
	const [demoExpenses] = await db.select({ n: sql<number>`count(*)` }).from(expenses).where(eq(expenses.isDemo, true));
	return {
		settings: await getSettings(db),
		designs: await db.select().from(designs).where(eq(designs.archived, false)),
		demo: { orders: Number(demoOrders?.n ?? 0), expenses: Number(demoExpenses?.n ?? 0) }
	};
};
