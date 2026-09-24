import { designImages, type ImageSide } from './schema';
import type { DB } from './types';

export type ImageVersions = Partial<Record<ImageSide, number>>;

/**
 * Which pictures each design has, and when each last changed. Selects only
 * the small columns, never the image data itself.
 */
export async function imageIndex(db: DB): Promise<Map<number, ImageVersions>> {
	const rows = await db
		.select({ designId: designImages.designId, side: designImages.side, updatedAt: designImages.updatedAt })
		.from(designImages);
	const map = new Map<number, ImageVersions>();
	for (const r of rows) {
		const entry = map.get(r.designId) ?? {};
		entry[r.side as ImageSide] = r.updatedAt;
		map.set(r.designId, entry);
	}
	return map;
}

/** The version goes in the URL, so a replaced picture is never served stale from cache. */
export function imageUrl(designId: number, side: ImageSide, version: number) {
	return `/api/design-image/${designId}/${side}?v=${version}`;
}
