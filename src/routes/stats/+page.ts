import { getDb } from '$lib/client/db';
import { financials, type Period } from '$lib/data/stats';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const raw = Number(url.searchParams.get('days') ?? 30);
	const days = ([30, 90, 365, 0] as const).includes(raw as Period) ? (raw as Period) : 30;
	return { days, ...(await financials(await getDb(), days)) };
};
