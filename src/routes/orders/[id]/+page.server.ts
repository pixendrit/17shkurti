import { error, fail, redirect } from '@sveltejs/kit';
import { addScreenshots, advance, deleteOrder, deletePayment, editOrder, recordPayment, removeScreenshot, setPrintReady } from '$lib/domain/commands/orders';
import { parseEvent, parseOrderEdit, parsePayment } from '$lib/domain/forms';
import { ok } from '$lib/domain/result';
import { orderView } from '$lib/domain/views';
import { act, context, load as world, notify, readForm, run } from '$lib/server/shop';

export const load = async (event) => {
	const v = orderView(await world(event), event.params.id);
	if (!v) throw error(404, 'Porosia nuk u gjet');
	return v;
};

export const actions = {
	notify,
	advance: (e) =>
		act(e, advance, (f) => {
			const event = parseEvent(f);
			return event.ok ? ok({ orderId: e.params.id, event: event.value }) : event;
		}),
	edit: (e) =>
		act(e, editOrder, (f) => {
			const edit = parseOrderEdit(f);
			return edit.ok ? ok({ orderId: e.params.id, edit: edit.value }) : edit;
		}),
	pay: (e) =>
		act(e, recordPayment, (f, ctx) => {
			const p = parsePayment(f, ctx.now);
			return p.ok ? ok({ orderId: e.params.id, ...p.value }) : p;
		}),
	unpay: (e) => act(e, deletePayment, (f) => ok(f.text('paymentId'))),
	addShots: (e) => act(e, addScreenshots, (f) => ok({ orderId: e.params.id, uploads: f.uploads('screenshot') })),
	removeShot: (e) => act(e, removeScreenshot, (f) => ok({ orderId: e.params.id, imageId: f.text('imageId') })),
	printReady: (e) =>
		act(e, setPrintReady, (f) => ok({ orderId: e.params.id, lineId: f.text('lineId'), ready: f.text('ready') === '1' })),
	delete: async (e) => {
		await readForm(e.request);
		const r = await run(e.locals.db, deleteOrder, e.params.id, context());
		if (!r.ok) return fail(400, { error: r.error });
		throw redirect(303, '/orders');
	}
};
