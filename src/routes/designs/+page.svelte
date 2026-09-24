<script lang="ts">
	import Empty from '$lib/components/Empty.svelte';
	import Plus from '@lucide/svelte/icons/plus';

	import { createDesign, toggleArchive } from '$lib/client/actions';

	let { data } = $props();
	let showAdd = $state(false);
	let name = $state('');
	let notes = $state('');
	let error = $state<string | null>(null);

	async function submit(e: Event) {
		e.preventDefault();
		error = await createDesign(name, notes);
		if (!error) {
			name = '';
			notes = '';
			showAdd = false;
		}
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
		</div>
		<button class="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ruaj dizajnin</button>
	</form>
{/if}

<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
	{#if data.designs.length === 0}
		<Empty message="Ende pa dizajne" hint="Shtoni çdo dizajn që printoni, pastaj ndiqni printimet DTF te Stoku." />
	{:else}
		<div class="divide-y divide-slate-100">
			{#each data.designs as d (d.id)}
				<div class="flex items-center justify-between gap-3 px-4 py-3 {d.archived ? 'opacity-50' : ''}">
					<div class="min-w-0">
						<p class="truncate font-medium text-slate-900">{d.name}</p>
						{#if d.notes}<p class="truncate text-sm text-slate-500">{d.notes}</p>{/if}
					</div>
					<div class="flex shrink-0 items-center gap-3">
						<span class="text-xs text-slate-500">
							<span class="tabular font-semibold text-slate-900">{d.transfers}</span> printime DTF
						</span>
						<button onclick={() => toggleArchive(d.id)} class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
							{d.archived ? 'Riktheje' : 'Arkivo'}
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
