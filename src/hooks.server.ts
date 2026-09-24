import { error, redirect, type Handle } from '@sveltejs/kit';
import { isAuthed } from '$lib/server/auth';

const PUBLIC = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	if (!env?.DB) throw error(500, 'Database binding missing');
	if (!env.SESSION_SECRET || !/^\d{4}$/.test(env.APP_PIN ?? '')) {
		throw error(500, 'APP_PIN (4 digits) and SESSION_SECRET must be set');
	}
	event.locals.db = env.DB;

	const isPublic = PUBLIC.some((p) => event.url.pathname.startsWith(p));
	const authed = await isAuthed(event.cookies, env.SESSION_SECRET);
	if (!authed && !isPublic) {
		if (event.url.pathname.startsWith('/api/')) throw error(401, 'Locked');
		throw redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	if (authed && event.url.pathname === '/login') throw redirect(303, '/');

	return resolve(event);
};
