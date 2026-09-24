import { error, json } from '@sveltejs/kit';
import { Buffer } from 'node:buffer';
import { createOrder, type ItemImages, type NewOrderInput } from '$lib/server/create-order';
import type { RequestHandler } from './$types';

/**
 * Create an order. Multipart: `order` is the JSON, and personalised items
 * bring their mockups as files named `item<index>_front` / `item<index>_back`.
 * One request, so an order can never exist without the mockups it requires.
 */
export const POST: RequestHandler = async ({ request, locals: { db } }) => {
	const form = await request.formData();
	let input: NewOrderInput;
	try {
		input = JSON.parse(String(form.get('order')));
	} catch {
		throw error(400, 'Kërkesë e pavlefshme');
	}

	const images: ItemImages = {};
	for (const [key, value] of form.entries()) {
		const m = /^item(\d+)_(front|back)$/.exec(key);
		if (!m || !(value instanceof File)) continue;
		const idx = Number(m[1]);
		images[idx] ??= {};
		images[idx][m[2] as 'front' | 'back'] = {
			mime: value.type,
			data: Buffer.from(await value.arrayBuffer()).toString('base64')
		};
	}

	const res = await createOrder(db, input, images);
	return json(res, { status: 'error' in res ? 400 : 200 });
};
