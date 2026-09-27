import { prioritiesView } from '$lib/domain/priorities';
import { load as world } from '$lib/server/shop';
import { priorityActions } from '$lib/server/priority-actions';

export const load = async (event) => prioritiesView(await world(event), Math.floor(Date.now() / 1000));

export const actions = priorityActions;
