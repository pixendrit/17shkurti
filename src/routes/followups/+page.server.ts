import { followUpsView } from '$lib/domain/views';
import { load as world, notify } from '$lib/server/shop';

export const load = async (event) => ({ rows: followUpsView(await world(event)) });

export const actions = { notify };
