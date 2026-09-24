import { fail, redirect } from '@sveltejs/kit';
import { createOrder } from '$lib/domain/commands/orders';
import { blankCost } from '$lib/domain/economics';
import { parseNewOrder } from '$lib/domain/forms';
import { GARMENTS } from '$lib/domain/model';
import { nextCode } from '$lib/domain/world';
import { context, load as world, readForm, run } from '$lib/server/shop';

export const load = async (event) => {
	const w = await world(event);
	return {
		code: nextCode(w.orders),
		// Enough of the world for the form to estimate costs exactly as the
		// server will: prices, prints, and what a blank costs today.
		costs: {
			settings: { ...w.settings, blankCost: Object.fromEntries(GARMENTS.map((g) => [g, blankCost(w, g)])) as typeof w.settings.blankCost },
			prints: w.prints,
			purchases: []
		},
		designs: w.designs
			.filter((d) => !d.archived)
			.map((d) => ({ id: d.id, name: d.name, prints: w.prints.filter((p) => p.designId === d.id) }))
	};
};

export const actions = {
	default: async (event) => {
		const input = parseNewOrder(await readForm(event.request));
		if (!input.ok) return fail(400, { error: input.error });
		const r = await run(event.locals.db, createOrder, input.value, context());
		if (!r.ok) return fail(400, { error: r.error });
		const created = r.value.find((c) => 'put' in c && c.put === 'order');
		throw redirect(303, created && 'put' in created ? `/orders/${created.value.id}` : '/orders');
	}
};
