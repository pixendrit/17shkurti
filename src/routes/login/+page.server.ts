import { fail, redirect } from '@sveltejs/kit';
import { checkPin, clearFailures, createSession, lockedFor, recordFailure } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url, locals, platform }) => {
		const env = platform!.env;
		const ip = getClientAddress();

		const wait = await lockedFor(locals.db, ip);
		if (wait > 0) {
			return fail(429, { error: `Shumë përpjekje. Provoni sërish pas ${Math.ceil(wait / 60)} min.` });
		}

		const pin = String((await request.formData()).get('pin') ?? '').trim();
		if (!/^\d{4}$/.test(pin)) return fail(400, { error: 'Shkruani kodin me 4 shifra.' });

		if (!checkPin(pin, env.APP_PIN)) {
			await recordFailure(locals.db, ip);
			return fail(401, { error: 'Kod i gabuar.' });
		}

		await clearFailures(locals.db, ip);
		await createSession(cookies, env.SESSION_SECRET, url.protocol === 'https:');

		const next = url.searchParams.get('next');
		throw redirect(303, next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
	}
};
