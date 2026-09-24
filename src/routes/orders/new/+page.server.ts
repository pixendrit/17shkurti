import { eq } from 'drizzle-orm';
import { nextOrderCode } from '$lib/data/orders';
import { designs } from '$lib/data/schema';
import { imageIndex } from '$lib/data/images';
import { getSettings } from '$lib/data/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {
	const images = await imageIndex(db);
	const active = await db.select().from(designs).where(eq(designs.archived, false));
	return {
		designs: active.map((d) => ({ ...d, images: images.get(d.id) ?? {} })),
		settings: await getSettings(db),
		code: await nextOrderCode(db)
	};
};
