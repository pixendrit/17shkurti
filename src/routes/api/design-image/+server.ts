import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { Buffer } from 'node:buffer';
import { designImages, designs, IMAGE_SIDES, type ImageSide } from '$lib/data/schema';
import type { RequestHandler } from './$types';

const TYPES = ['image/webp', 'image/jpeg', 'image/png'];
// The browser shrinks images before upload; this guards the D1 row size limit
// (2 MB) with room to spare once base64 adds its third.
const MAX_BYTES = 700 * 1024;

export const POST: RequestHandler = async ({ request, locals: { db } }) => {
	const form = await request.formData();
	const designId = Number(form.get('designId'));
	const side = String(form.get('side')) as ImageSide;
	const file = form.get('file');

	if (!Number.isInteger(designId) || !IMAGE_SIDES.includes(side)) throw error(400, 'Kërkesë e pavlefshme');
	if (!(file instanceof File) || !TYPES.includes(file.type)) {
		return json({ error: 'Lejohen vetëm foto WebP, JPEG ose PNG.' }, { status: 400 });
	}
	if (file.size > MAX_BYTES) return json({ error: 'Fotoja është shumë e madhe.' }, { status: 400 });

	const [design] = await db.select({ id: designs.id }).from(designs).where(eq(designs.id, designId)).limit(1);
	if (!design) throw error(404, 'Dizajni nuk u gjet');

	const data = Buffer.from(await file.arrayBuffer()).toString('base64');
	const updatedAt = Math.floor(Date.now() / 1000);

	await db
		.insert(designImages)
		.values({ designId, side, mime: file.type, data, updatedAt })
		.onConflictDoUpdate({
			target: [designImages.designId, designImages.side],
			set: { mime: file.type, data, updatedAt }
		});

	return json({ ok: true, updatedAt });
};
