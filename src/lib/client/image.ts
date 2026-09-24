import { invalidateAll } from '$app/navigation';
import type { ImageSide } from '$lib/data/schema';

/**
 * Shrink a photo in the browser before it is uploaded: phone photos and
 * mockups are often several megabytes, which is far more than a thumbnail
 * needs and more than a database row should hold.
 */
export async function shrinkImage(file: File, maxSide = 900): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	// White underneath, so a transparent PNG doesn't turn black as JPEG.
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, w, h);
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();

	const encode = (type: string, quality: number) =>
		new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
	// Older Safari can't encode WebP and quietly hands back PNG; fall back to JPEG there.
	const webp = await encode('image/webp', 0.8);
	if (webp && webp.type === 'image/webp') return webp;
	const jpeg = await encode('image/jpeg', 0.85);
	if (!jpeg) throw new Error('Fotoja nuk u përpunua.');
	return jpeg;
}

export async function uploadDesignImage(designId: number, side: ImageSide, file: File) {
	const blob = await shrinkImage(file);
	const form = new FormData();
	form.set('designId', String(designId));
	form.set('side', side);
	form.set('file', new File([blob], `${side}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type }));

	const res = await fetch('/api/design-image', { method: 'POST', body: form });
	const body = (await res.json().catch(() => ({}))) as { error?: string };
	if (!res.ok || body.error) throw new Error(body.error ?? 'Fotoja nuk u ngarkua.');
	await invalidateAll();
}
