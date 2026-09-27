import { emptyTrash, purgeOrder, restoreOrder } from '$lib/domain/commands/orders';
import { ok } from '$lib/domain/result';
import { trashView } from '$lib/domain/views';
import { act, load as world } from '$lib/server/shop';

export const load = async (event) => ({ rows: trashView(await world(event)) });

export const actions = {
	restore: (e) => act(e, restoreOrder, (f) => ok(f.text('orderId'))),
	purge: (e) => act(e, purgeOrder, (f) => ok(f.text('orderId'))),
	empty: (e) => act(e, emptyTrash, () => ok(null))
};
