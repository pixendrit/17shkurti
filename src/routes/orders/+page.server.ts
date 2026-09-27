import { restoreOrder } from '$lib/domain/commands/orders';
import { ok } from '$lib/domain/result';
import { act, load as world } from '$lib/server/shop';
import { ORDER_TABS, ordersView, type OrderTab } from '$lib/domain/views';

export const load = async (event) => {
	const t = event.url.searchParams.get('tab') ?? 'open';
	const tab = (ORDER_TABS as readonly string[]).includes(t) ? (t as OrderTab) : 'open';
	const w = await world(event);
	const trashedId = event.url.searchParams.get('trashed');
	const justTrashed = trashedId ? (w.trash.find((t) => t.order.id === trashedId)?.order ?? null) : null;
	return {
		...ordersView(w, tab, event.url.searchParams.get('q') ?? ''),
		justTrashed: justTrashed && { id: justTrashed.id, code: justTrashed.code }
	};
};

export const actions = {
	restore: (e) => act(e, restoreOrder, (f) => ok(f.text('orderId')))
};
