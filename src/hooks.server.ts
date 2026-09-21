import { redirect, type Handle } from '@sveltejs/kit';
import { isAuthed } from '$lib/server/auth';

const PUBLIC_ROUTES = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const authed = isAuthed(event.cookies);
	event.locals.authed = authed;

	const isPublic = PUBLIC_ROUTES.some((p) => event.url.pathname.startsWith(p));

	if (!authed && !isPublic) {
		throw redirect(303, `/login?next=${encodeURIComponent(event.url.pathname)}`);
	}
	if (authed && event.url.pathname === '/login') {
		throw redirect(303, '/');
	}

	return resolve(event);
};
