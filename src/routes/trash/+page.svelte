<script lang="ts">
	import { enhance } from '$app/forms';
	import Empty from '$lib/components/Empty.svelte';
	import FormError from '$lib/components/FormError.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { busy } from '$lib/client/enhance';
	import { money, formatDateTime, plural } from '$lib/ui';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let { data } = $props();
</script>

<svelte:head><title>Koshi — Hijeshi</title></svelte:head>

<div class="mb-1 flex items-center justify-between gap-3">
	<h1 class="flex items-center gap-2 text-xl font-semibold text-slate-900"><Trash2 class="size-5 text-slate-500" /> Koshi</h1>
	{#if data.rows.length}
		<form method="POST" action="?/empty" use:enhance={busy({ confirm: `Të fshihen përgjithmonë ${plural(data.rows.length, 'porosi', 'porosi')} nga koshi? Kjo nuk kthehet më.` })}>
			<button class="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Zbraz koshin</button>
		</form>
	{/if}
</div>
<p class="mb-4 max-w-prose text-sm text-slate-600">
	Porositë e fshira rrinë këtu me gjithçka të tyre (pagesat, fotot, stokun që kishin marrë). Nuk llogariten askund derisa t'i rikthesh. „Fshi përgjithmonë” nuk kthehet më.
</p>

<FormError />

<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
	{#if data.rows.length === 0}
		<Empty message="Koshi është bosh" hint="Kur fshin një porosi, vjen këtu dhe mund ta rikthesh." />
	{:else}
		<ul class="divide-y divide-slate-100">
			{#each data.rows as o (o.id)}
				<li class="flex flex-wrap items-center gap-3 px-4 py-3">
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-slate-900">{o.customer} <span class="font-mono text-xs text-slate-400">{o.code}</span></p>
						<p class="truncate text-xs text-slate-500">{o.summary}</p>
						<p class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
							<StatusBadge status={o.status} label={o.statusLabel} />
							{o.kind === 'gift' ? 'Dhuratë' : money(o.total)}{#if o.paid} · paguar {money(o.paid)}{/if} · u fshi {formatDateTime(o.deletedAt)}
						</p>
					</div>
					<div class="flex shrink-0 gap-2">
						<form method="POST" action="?/restore" use:enhance={busy()}>
							<input type="hidden" name="orderId" value={o.id} />
							<button class="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"><RotateCcw class="size-3.5" /> Rikthe</button>
						</form>
						<form method="POST" action="?/purge" use:enhance={busy({ confirm: `Ta fshij përgjithmonë ${o.code}? Kjo nuk kthehet më.` })}>
							<input type="hidden" name="orderId" value={o.id} />
							<button class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">Fshi përgjithmonë</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
