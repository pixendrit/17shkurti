import { clearDemo, saveSettings } from '$lib/domain/commands/stock';
import { blankCost } from '$lib/domain/economics';
import { parseSettings } from '$lib/domain/forms';
import { GARMENTS } from '$lib/domain/model';
import { ok } from '$lib/domain/result';
import { act, load as world } from '$lib/server/shop';

export const load = async (event) => {
	const w = await world(event);
	const bought = (g: (typeof GARMENTS)[number]) =>
		w.purchases.some((p) => p.kind === 'blanks' && p.lines.some((l) => l.sku.garment === g));
	return {
		settings: w.settings,
		/** What a blank costs from real purchases, where there are some. */
		boughtCost: Object.fromEntries(GARMENTS.map((g) => [g, bought(g) ? blankCost(w, g) : null])),
		perSheet: w.prints[0]?.perSheet ?? 4,
		demo: { orders: w.orders.filter((o) => o.isDemo).length, purchases: w.purchases.filter((p) => p.isDemo).length }
	};
};

export const actions = {
	save: (e) => act(e, saveSettings, (f) => parseSettings(f)),
	clearDemo: (e) => act(e, clearDemo, () => ok(null))
};
