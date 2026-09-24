<script lang="ts">
	import Empty from '$lib/components/Empty.svelte';
	import DesignThumb from '$lib/components/DesignThumb.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Upload from '@lucide/svelte/icons/upload';

	import { createDesign, renameDesign, toggleArchive } from '$lib/client/actions';
	import { uploadDesignImage } from '$lib/client/image';
	import type { ImageSide } from '$lib/data/schema';

	let { data } = $props();
	let showAdd = $state(false);
	let name = $state('');
	let notes = $state('');
	let front = $state<File | null>(null);
	let back = $state<File | null>(null);
	let error = $state<string | null>(null);
	let saving = $state(false);
	/** "<designId>-<side>" while that picture uploads. */
	let uploading = $state<string | null>(null);

	const SIDES: { side: ImageSide; label: string }[] = [
		{ side: 'front', label: 'Para' },
		{ side: 'back', label: 'Pas' }
	];

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		saving = true;
		try {
			const res = await createDesign(name, notes);
			if ('error' in res) {
				error = res.error;
				return;
			}
			if (front) await uploadDesignImage(res.id, 'front', front);
			if (back) await uploadDesignImage(res.id, 'back', back);
			name = '';
			notes = '';
			front = back = null;
			showAdd = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Dizajni nuk u ruajt.';
		} finally {
			saving = false;
		}
	}

	async function upload(designId: number, side: ImageSide, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		error = null;
		uploading = `${designId}-${side}`;
		try {
			await uploadDesignImage(designId, side, file);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Fotoja nuk u ngarkua.';
		} finally {
			uploading = null;
		}
	}

	async function rename(id: number, current: string) {
		const next = prompt('Emri i ri i dizajnit:', current);
		if (next === null || next.trim() === current) return;
		error = await renameDesign(id, next);
	}
</script>

<svelte:head><title>Dizajnet — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-slate-900">Dizajnet</h1>
	<button onclick={() => (showAdd = !showAdd)} class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
		<Plus class="size-4" /> Dizajn i ri
	</button>
</div>

{#if error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
{/if}

{#if showAdd}
	<form onsubmit={submit} class="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="grid gap-3 sm:grid-cols-3">
			<label class="block sm:col-span-1">
				<span class="mb-1 block text-xs font-medium text-slate-600">Emri *</span>
				<input bind:value={name} required placeholder="p.sh. Shqiponja" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="block sm:col-span-2">
				<span class="mb-1 block text-xs font-medium text-slate-600">Shënime</span>
				<input bind:value={notes} placeholder="Madhësia e printit, ngjyrat, ku ndodhet skedari…" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Foto para</span>
				<input type="file" accept="image/*" onchange={(e) => (front = e.currentTarget.files?.[0] ?? null)} class="w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Foto pas</span>
				<input type="file" accept="image/*" onchange={(e) => (back = e.currentTarget.files?.[0] ?? null)} class="w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5" />
			</label>
		</div>
		<button disabled={saving} class="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
			{saving ? 'Duke ruajtur…' : 'Ruaj dizajnin'}
		</button>
	</form>
{/if}

{#if data.designs.length === 0}
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<Empty message="Ende pa dizajne" hint="Shtoni çdo dizajn që printoni, pastaj ndiqni printimet DTF te Stoku." />
	</section>
{:else}
	<div class="grid gap-3 sm:grid-cols-2">
		{#each data.designs as d (d.id)}
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm {d.archived ? 'opacity-50' : ''}">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="truncate font-semibold text-slate-900">{d.name}</p>
						{#if d.notes}<p class="truncate text-sm text-slate-500">{d.notes}</p>{/if}
						<p class="mt-0.5 text-xs text-slate-500">
							<span class="tabular font-semibold text-slate-900">{d.transfers}</span> printime DTF
						</p>
					</div>
					<div class="flex shrink-0 gap-1">
						<button onclick={() => rename(d.id, d.name)} aria-label="Ndrysho emrin" class="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50">
							<Pencil class="size-3.5" />
						</button>
						<button onclick={() => toggleArchive(d.id)} class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
							{d.archived ? 'Riktheje' : 'Arkivo'}
						</button>
					</div>
				</div>

				<div class="mt-3 grid grid-cols-2 gap-3">
					{#each SIDES as s (s.side)}
						<div>
							<DesignThumb designId={d.id} images={d.images} side={s.side} size="aspect-square w-full" alt="{d.name} — {s.label}" />
							<label class="mt-1.5 flex cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-300 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
								<Upload class="size-3" />
								{uploading === `${d.id}-${s.side}` ? 'Duke ngarkuar…' : d.images[s.side] ? `Ndrysho ${s.label.toLowerCase()}` : `Foto ${s.label.toLowerCase()}`}
								<input type="file" accept="image/*" class="hidden" onchange={(e) => upload(d.id, s.side, e)} />
							</label>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}
