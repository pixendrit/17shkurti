import { deletePurchase, recordPurchase } from '$lib/domain/commands/stock';
import { blankCost } from '$lib/domain/economics';
import { parsePurchase } from '$lib/domain/forms';
import { ok } from '$lib/domain/result';
import { purchasesView } from '$lib/domain/views';
import { act, load as world } from '$lib/server/shop';

export const load = async (event) => {
	const w = await world(event);
	const designs = new Map(w.designs.map((d) => [d.id, d]));
	return {
		...purchasesView(w),
		kind: event.url.searchParams.get('kind'),
		sheetPrice: w.settings.sheetPrice,
		blankCost: blankCost(w, 'oversized_200g'),
		prints: w.prints
			.filter((p) => !designs.get(p.designId)?.archived)
			.map((p) => ({ id: p.id, name: designs.get(p.designId)?.name ?? '?', color: p.shirtColor, perSheet: p.perSheet }))
			.sort((a, b) => a.name.localeCompare(b.name) || a.color.localeCompare(b.color))
	};
};

export const actions = {
	record: (e) => act(e, recordPurchase, (f, ctx) => parsePurchase(f, ctx.now)),
	delete: (e) => act(e, deletePurchase, (f) => ok(f.text('purchaseId')))
};
