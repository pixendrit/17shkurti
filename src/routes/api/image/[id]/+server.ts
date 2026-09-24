import { error } from '@sveltejs/kit';
import { getImage } from '$lib/server/repo';

/** A picture. Its id changes whenever it's replaced, so it can be cached forever. */
export async function GET({ params, locals }) {
	const img = await getImage(locals.db, params.id);
	if (!img) throw error(404, 'Nuk u gjet');
	const bin = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
	return new Response(bin, {
		headers: { 'content-type': img.mime, 'cache-control': 'private, max-age=31536000, immutable' }
	});
}
