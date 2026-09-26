import { error, fail, redirect } from '@sveltejs/kit';
import { editLines } from '$lib/domain/commands/orders';
import { parseLines } from '$lib/domain/forms';
import { isUnmade } from '$lib/domain/process';
import { context, load as world, readForm, run } from '$lib/server/shop';

export const load = async (event) => {
	const w = await world(event);
	const order = w.orders.find((o) => o.id === event.params.id);
	if (!order) throw error(404, 'Porosia nuk u gjet');
	if (!isUnmade(order)) throw redirect(303, `/orders/${order.id}`);
	return {
		order,
		prints: w.prints,
		defaultPrice: w.settings.defaultPrice,
		designs: w.designs
			.filter((d) => !d.archived || order.lines.some((l) => l.artwork.kind === 'print' && w.prints.some((p) => p.id === (l.artwork as { printId: string }).printId && p.designId === d.id)))
			.map((d) => ({ id: d.id, name: d.name, prints: w.prints.filter((p) => p.designId === d.id) }))
	};
};

export const actions = {
	default: async (event) => {
		const lines = parseLines(await readForm(event.request));
		if (!lines.ok) return fail(400, { error: lines.error });
		const r = await run(event.locals.db, editLines, { orderId: event.params.id, lines: lines.value }, context());
		if (!r.ok) return fail(400, { error: r.error });
		throw redirect(303, `/orders/${event.params.id}`);
	}
};
