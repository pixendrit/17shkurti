import { financials, PERIODS, type Period } from '$lib/domain/stats';
import { load as world } from '$lib/server/shop';

export const load = async (event) => {
	const d = Number(event.url.searchParams.get('days') ?? 30);
	const days = (PERIODS as number[]).includes(d) ? (d as Period) : 30;
	return financials(await world(event), days, Math.floor(Date.now() / 1000));
};
