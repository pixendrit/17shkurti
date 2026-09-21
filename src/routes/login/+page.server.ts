import { fail, redirect } from '@sveltejs/kit';
import { checkPin, clearFailures, createSession, lockedFor, recordFailure } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const ip = getClientAddress();

		const wait = lockedFor(ip);
		if (wait > 0) {
			return fail(429, { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` });
		}

		const data = await request.formData();
		const pin = String(data.get('pin') ?? '').trim();

		if (!/^\d{4}$/.test(pin)) {
			return fail(400, { error: 'Enter the 4-digit code.' });
		}

		if (!checkPin(pin)) {
			recordFailure(ip);
			return fail(401, { error: 'Wrong code.' });
		}

		clearFailures(ip);
		createSession(cookies);

		const next = url.searchParams.get('next');
		throw redirect(303, next && next.startsWith('/') ? next : '/');
	}
};
