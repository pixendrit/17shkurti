/**
 * shrink : HTMLInputElement (url -> void) -> action
 * For picture fields: phone photos are several megabytes, far more than the
 * app needs. When a picture is picked it is shrunk in the browser to at most
 * 900 px as WebP (JPEG where the browser can't make WebP) and put back into
 * the field, so the form uploads the small one. `onpreview` gets a URL to
 * show it (or null when the field is cleared), and the field itself.
 */
export function shrink(input: HTMLInputElement, onpreview?: (url: string | null, input: HTMLInputElement) => void) {
	let url: string | null = null;
	async function change() {
		const file = input.files?.[0];
		if (url) URL.revokeObjectURL(url);
		url = null;
		if (!file) return onpreview?.(null, input);
		if (!file.type.startsWith('image/')) return;
		try {
			const blob = await shrinkImage(file);
			const dt = new DataTransfer();
			dt.items.add(new File([blob], blob.type === 'image/webp' ? 'foto.webp' : 'foto.jpg', { type: blob.type }));
			input.files = dt.files;
			url = URL.createObjectURL(blob);
		} catch {
			url = URL.createObjectURL(file);
		}
		onpreview?.(url, input);
	}
	input.addEventListener('change', change);
	return {
		destroy() {
			input.removeEventListener('change', change);
			if (url) URL.revokeObjectURL(url);
		}
	};
}

async function shrinkImage(file: File, maxSide = 900): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	const ctx = canvas.getContext('2d')!;
	// White underneath, so a transparent PNG doesn't turn black as JPEG.
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	const encode = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
	// Older Safari can't encode WebP and quietly hands back PNG; use JPEG there.
	const webp = await encode('image/webp', 0.8);
	if (webp && webp.type === 'image/webp') return webp;
	const jpeg = await encode('image/jpeg', 0.85);
	if (!jpeg) throw new Error('Fotoja nuk u përpunua.');
	return jpeg;
}
