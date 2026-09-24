import { json } from '@sveltejs/kit';
import { loadWorld } from '$lib/server/repo';
import { dayInput } from '$lib/domain/time';

/** Everything except the pictures, as one JSON file. */
export async function GET({ locals }) {
	const world = await loadWorld(locals.db);
	return json(world, {
		headers: {
			'content-disposition': `attachment; filename="hijeshi-${dayInput(Math.floor(Date.now() / 1000))}.json"`
		}
	});
}
