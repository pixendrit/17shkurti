import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { Buffer } from 'node:buffer';
import { IMAGE_SIDES, orderItemImages } from '$lib/data/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { db } }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || !IMAGE_SIDES.includes(params.side as never)) throw error(404);
	const [row] = await db
		.select()
		.from(orderItemImages)
		.where(and(eq(orderItemImages.itemId, id), eq(orderItemImages.side, params.side)))
		.limit(1);
	if (!row) throw error(404);
	return new Response(Buffer.from(row.data, 'base64'), {
		headers: { 'content-type': row.mime, 'cache-control': 'private, max-age=31536000, immutable' }
	});
};
