import { redirect } from '@sveltejs/kit';
import { destroySession } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	throw redirect(303, '/');
};

export const actions: Actions = {
	default: ({ cookies }) => {
		destroySession(cookies);
		throw redirect(303, '/login');
	}
};
