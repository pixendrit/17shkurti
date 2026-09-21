<script lang="ts">
	import Empty from '$lib/components/Empty.svelte';
	import Plus from '@lucide/svelte/icons/plus';

	let { data, form } = $props();
	let showAdd = $state(false);
</script>

<svelte:head><title>Designs — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-slate-900">Designs</h1>
	<button onclick={() => (showAdd = !showAdd)} class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
		<Plus class="size-4" /> New design
	</button>
</div>

{#if form?.error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}

{#if showAdd}
	<form method="POST" action="?/create" class="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="grid gap-3 sm:grid-cols-3">
			<label class="block sm:col-span-1">
				<span class="mb-1 block text-xs font-medium text-slate-600">Name *</span>
				<input name="name" required placeholder="e.g. Shqiponja" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="block sm:col-span-2">
				<span class="mb-1 block text-xs font-medium text-slate-600">Notes</span>
				<input name="notes" placeholder="Print size, colours, where the file lives…" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
		</div>
		<button class="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save design</button>
	</form>
{/if}

<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
	{#if data.designs.length === 0}
		<Empty message="No designs yet" hint="Add each artwork you print, then track its DTF film under Stock." />
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
							<span class="tabular font-semibold text-slate-900">{d.transfers}</span> transfers
						</span>
						<form method="POST" action="?/archive">
							<input type="hidden" name="id" value={d.id} />
							<button class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
								{d.archived ? 'Restore' : 'Archive'}
							</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
