<script lang="ts">
	import FormError from '$lib/components/FormError.svelte';
	import FollowUpItem from '$lib/components/FollowUpItem.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { FOLLOW_UPS } from '$lib/domain/model';
	import { FOLLOW_UP_TASKS } from '$lib/ui';

	let { data } = $props();
	let only = $state<string>('all');
	const shown = $derived(only === 'all' ? data.rows : data.rows.filter((r) => r.stage === only));
</script>

<svelte:head><title>Njofto klientët — Hijeshi</title></svelte:head>

<h1 class="mb-1 text-xl font-semibold text-slate-900">Njofto klientët</h1>
<p class="mb-4 max-w-prose text-sm text-slate-600">
	Kur porosia bëhet gati, niset ose dorëzohet, klienti del këtu me mesazhin gati. Dërgoje me WhatsApp ose kopjoje në Instagram/Messenger, pastaj shtyp <b>U njoftua</b>. Tekstin e mesazheve e ndryshon te Cilësimet.
</p>

<FormError />

<div class="mb-3 flex gap-1 overflow-x-auto pb-1">
	<button onclick={() => (only = 'all')} class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium {only === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">Të gjitha <span class="text-xs opacity-60">{data.rows.length}</span></button>
	{#each FOLLOW_UPS as s (s)}
		<button onclick={() => (only = s)} class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium {only === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">{FOLLOW_UP_TASKS[s]} <span class="text-xs opacity-60">{data.rows.filter((r) => r.stage === s).length}</span></button>
	{/each}
</div>

<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
	{#if shown.length === 0}
		<Empty message="Asnjë klient për të njoftuar" hint="Kur porositë lëvizin përpara, dalin këtu." />
	{:else}
		<div class="divide-y divide-slate-100">
			{#each shown as r (r.id + r.stage)}
				<FollowUpItem orderId={r.id} code={r.code} customer={r.customer} stage={r.stage} since={r.since} message={r.message} whatsapp={r.whatsapp} />
			{/each}
		</div>
	{/if}
</section>
