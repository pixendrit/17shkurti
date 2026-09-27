import { load as world, notify } from '$lib/server/shop';
import { prioritiesView } from '$lib/domain/priorities';
import { priorityActions } from '$lib/server/priority-actions';
import { dashboardView } from '$lib/domain/views';

export const load = async (event) => {
	const w = await world(event);
	const now = Math.floor(Date.now() / 1000);
	return { ...dashboardView(w, now), priorities: prioritiesView(w, now).thisWeek };
};

export const actions = { notify, ...priorityActions };
