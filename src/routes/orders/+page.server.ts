import { load as world } from '$lib/server/shop';
import { ORDER_TABS, ordersView, type OrderTab } from '$lib/domain/views';

export const load = async (event) => {
	const t = event.url.searchParams.get('tab') ?? 'open';
	const tab = (ORDER_TABS as readonly string[]).includes(t) ? (t as OrderTab) : 'open';
	return ordersView(await world(event), tab, event.url.searchParams.get('q') ?? '');
};
