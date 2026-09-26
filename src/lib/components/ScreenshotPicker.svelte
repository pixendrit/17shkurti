<script lang="ts">
	/**
	 * Screenshots of a conversation: pick several at once (or paste them, on a
	 * computer), see them, drop the wrong one. They're shrunk in the browser to
	 * 1600 px, sharp enough to read the chat, and posted as the form's
	 * `screenshot` field.
	 */
	import { onMount } from 'svelte';
	import { shrinkImage } from '$lib/client/shrink';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import X from '@lucide/svelte/icons/x';

	let { name = 'screenshot', label = 'Shto screenshot', big = false }: { name?: string; label?: string; big?: boolean } = $props();

	let picked = $state<{ file: File; url: string }[]>([]);
	let busy = $state(false);
	let field: HTMLInputElement;
	let pick: HTMLInputElement;

	/** The form posts what's in the hidden field: keep it in step with the list. */
	function sync() {
		const dt = new DataTransfer();
		for (const p of picked) dt.items.add(p.file);
		field.files = dt.files;
	}

	async function add(files: Iterable<File>) {
		busy = true;
		for (const f of files) {
			if (!f.type.startsWith('image/')) continue;
			let blob: Blob = f;
			try {
				blob = await shrinkImage(f, 1600);
			} catch {
				/* keep the original */
			}
			const file = new File([blob], `screenshot.${blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'}`, { type: blob.type });
			picked.push({ file, url: URL.createObjectURL(file) });
		}
		sync();
		busy = false;
	}

	function remove(i: number) {
		URL.revokeObjectURL(picked[i].url);
		picked.splice(i, 1);
		sync();
	}

	onMount(() => {
		// On a computer, a copied screenshot can be pasted straight in.
		const onPaste = (e: ClipboardEvent) => {
			const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
			if (files.length) {
				e.preventDefault();
				add(files);
			}
		};
		// A form that was reset (after saving) starts empty again.
		const onReset = () => {
			for (const p of picked) URL.revokeObjectURL(p.url);
			picked = [];
		};
		window.addEventListener('paste', onPaste);
		field.form?.addEventListener('reset', onReset);
		return () => {
			window.removeEventListener('paste', onPaste);
			field.form?.removeEventListener('reset', onReset);
			for (const p of picked) URL.revokeObjectURL(p.url);
		};
	});
</script>

<input bind:this={field} type="file" {name} multiple accept="image/*" class="hidden" tabindex="-1" aria-hidden="true" />

<div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
	{#each picked as p, i (p.url)}
		<div class="relative">
			<img src={p.url} alt="Screenshot {i + 1}" class="aspect-[9/16] w-full rounded-lg border border-slate-200 object-cover object-top" />
			<button type="button" onclick={() => remove(i)} aria-label="Hiq screenshot-in {i + 1}" class="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-white hover:bg-red-600"><X class="size-3.5" /></button>
		</div>
	{/each}
	<label class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-white p-3 text-center text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 {big && picked.length === 0 ? 'col-span-3 py-10 text-sm sm:col-span-4' : 'aspect-[9/16]'}">
		<ImagePlus class={big && picked.length === 0 ? 'size-8' : 'size-5'} />
		{busy ? 'Duke përgatitur…' : picked.length ? 'Shto edhe' : label}
		<input bind:this={pick} type="file" multiple accept="image/*" class="sr-only" onchange={async () => { await add([...(pick.files ?? [])]); pick.value = ''; }} />
	</label>
</div>
