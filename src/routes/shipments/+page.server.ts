import { advanceMany, settle } from '$lib/domain/commands/orders';
import { parseEvent } from '$lib/domain/forms';
import { PAYMENT_METHODS, type PaymentMethod } from '$lib/domain/model';
import { ok } from '$lib/domain/result';
import { shipmentsView } from '$lib/domain/views';
import { act, load as world } from '$lib/server/shop';

export const load = async (event) => shipmentsView(await world(event));

export const actions = {
	advance: (e) =>
		act(e, advanceMany, (f) => {
			const event = parseEvent(f);
			return event.ok ? ok({ orderIds: f.list('orderId'), event: event.value }) : event;
		}),
	settle: (e) =>
		act(e, settle, (f) => {
			const m = f.text('method');
			const method: PaymentMethod = (PAYMENT_METHODS as readonly string[]).includes(m) ? (m as PaymentMethod) : 'cod';
			return ok({ orderIds: f.list('orderId'), method });
		})
};
