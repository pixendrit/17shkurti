import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	return { authed: locals.authed, pathname: url.pathname };
};
