import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { Buffer } from 'node:buffer';
import { designImages, IMAGE_SIDES } from '$lib/data/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { db } }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || !IMAGE_SIDES.includes(params.side as never)) throw error(404);

	const [row] = await db
		.select()
		.from(designImages)
		.where(and(eq(designImages.designId, id), eq(designImages.side, params.side)))
		.limit(1);
	if (!row) throw error(404);

	return new Response(Buffer.from(row.data, 'base64'), {
		headers: {
			'content-type': row.mime,
			// URLs carry ?v=<updatedAt>, so a given URL never changes content.
			// Private: images sit behind the PIN, so no shared caches.
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
};
