import { customersView } from '$lib/domain/views';
import { load as world } from '$lib/server/shop';

export const load = async (event) => {
	const q = event.url.searchParams.get('q') ?? '';
	return { q, customers: customersView(await world(event), q) };
};
