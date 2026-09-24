import { eq } from 'drizzle-orm';
import { settings } from './schema';
import type { DB } from './types';

/** Everything that decides what a shirt costs. Edited on the Settings page. */
export type CostSettings = {
	/** Pre-filled price per shirt on new orders. */
	defaultPrice: number;
	/** One 56 × 100 cm DTF sheet. */
	dtfSheetPrice: number;
	/** How many personalised prints (front + back) fit on one sheet. */
	customShirtsPerSheet: number;
	/** Your time to press, fold and pack one shirt. */
	laborPerShirt: number;
	/** Bag/mailer, per parcel. */
	packagingPerOrder: number;
	/** Buying price of one blank, by product type, used until real purchases set it. */
	blankCost: Record<string, number>;
	/** What the courier charges the shop per parcel, by country. */
	postCost: Record<string, number>;
};

export const DEFAULT_SETTINGS: CostSettings = {
	defaultPrice: 25,
	dtfSheetPrice: 12,
	customShirtsPerSheet: 4,
	laborPerShirt: 2,
	packagingPerOrder: 0.12,
	blankCost: { 'Oversized 200g': 8, 'Regular Fit': 8 },
	postCost: { XK: 2.5, AL: 5, MK: 5, OTHER: 5 }
};

const KEY = 'costs';

export async function getSettings(db: DB): Promise<CostSettings> {
	const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
	if (!row) return structuredClone(DEFAULT_SETTINGS);
	const stored = JSON.parse(row.value) as Partial<CostSettings>;
	// Merge, so a setting added later still has its default.
	return {
		...DEFAULT_SETTINGS,
		...stored,
		blankCost: { ...DEFAULT_SETTINGS.blankCost, ...stored.blankCost },
		postCost: { ...DEFAULT_SETTINGS.postCost, ...stored.postCost }
	};
}

export async function saveSettings(db: DB, next: CostSettings) {
	const value = JSON.stringify(next);
	await db
		.insert(settings)
		.values({ key: KEY, value })
		.onConflictDoUpdate({ target: settings.key, set: { value } });
}
