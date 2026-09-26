import { load as world, notify } from '$lib/server/shop';
import { dashboardView } from '$lib/domain/views';

export const load = async (event) => dashboardView(await world(event), Math.floor(Date.now() / 1000));

export const actions = { notify };
