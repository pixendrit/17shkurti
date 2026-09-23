import { financials, type Period } from '$lib/data/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { db } }) => {
	const raw = Number(url.searchParams.get('days') ?? 30);
	const days = ([30, 90, 365, 0] as const).includes(raw as Period) ? (raw as Period) : 30;
	return { days, ...(await financials(db, days)) };
};
