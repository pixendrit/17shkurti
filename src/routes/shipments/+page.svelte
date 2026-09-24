<script lang="ts">
	import { enhance } from '$app/forms';
	import FormError from '$lib/components/FormError.svelte';
	import { busy } from '$lib/client/enhance';
	import { money, formatDate } from '$lib/ui';
	import type { OrderRow } from '$lib/domain/views';
	import Truck from '@lucide/svelte/icons/truck';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import Hand from '@lucide/svelte/icons/hand';
	import Wallet from '@lucide/svelte/icons/wallet';
	import Gift from '@lucide/svelte/icons/gift';
	import type { Component } from 'svelte';

	let { data } = $props();

	/** Picked order ids per section, so a pile can be handled in one go. */
	let picked = $state<Record<string, string[]>>({ waiting: [], courier: [], hand: [], unpaid: [] });
	const sum = (rows: OrderRow[], ids: string[]) => rows.filter((r) => ids.includes(r.id)).reduce((a, r) => a + r.balance, 0);
	const clear = () => (picked = { waiting: [], courier: [], hand: [], unpaid: [] });
</script>

<svelte:head><title>Dërgesat — Hijeshi</title></svelte:head>

<h1 class="mb-5 text-xl font-semibold text-slate-900">Dërgesat</h1>

<FormError />

{#snippet section(key: string, title: string, Icon: Component, tone: string, rows: OrderRow[], empty: string, action: string, buttons: [string, string, string][], money_: boolean)}
	<section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<Icon class="size-4 {tone}" />
			<h2 class="text-sm font-semibold text-slate-900">{title}</h2>
			<span class="ml-auto text-xs text-slate-400">{money_ ? money(rows.reduce((a, r) => a + r.balance, 0)) : rows.length}</span>
		</header>
		{#if rows.length === 0}
			<p class="px-4 py-6 text-center text-sm text-slate-500">{empty}</p>
		{:else}
			<form method="POST" action={action} use:enhance={busy({ after: clear })}>
				<label class="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
					<input type="checkbox" checked={picked[key].length === rows.length} onchange={() => (picked[key] = picked[key].length === rows.length ? [] : rows.map((r) => r.id))} class="size-4 rounded border-slate-300" />
					Zgjidh të gjitha
				</label>
				<ul class="divide-y divide-slate-100">
					{#each rows as r (r.id)}
						<li class="flex items-center gap-3 px-4 py-2.5">
							<input type="checkbox" name="orderId" value={r.id} bind:group={picked[key]} aria-label="Zgjidh {r.code}" class="size-4 shrink-0 rounded border-slate-300" />
							<a href="/orders/{r.id}" class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-900">{r.customer} {#if r.kind === 'gift'}<Gift class="inline size-3.5 text-pink-600" />{/if}</p>
								<p class="truncate text-xs text-slate-500">
									<span class="font-mono">{r.code}</span> · {r.city || r.phone} · {r.units} copë
									{#if r.trackingRef} · <span class="font-mono">{r.trackingRef}</span>{/if}
								</p>
							</a>
							<div class="shrink-0 text-right">
								<p class="tabular text-sm font-medium">{r.kind === 'gift' ? 'Falas' : money(money_ ? r.balance : r.total)}</p>
								<p class="text-[11px] text-slate-400">{formatDate(r.createdAt)}</p>
							</div>
						</li>
					{/each}
				</ul>
				{#if key === 'unpaid'}<input type="hidden" name="method" value="cod" />{/if}
				<div class="flex gap-2 border-t border-slate-100 p-3">
					{#each buttons as [name, value, text] (value)}
						<button {name} {value} disabled={!picked[key].length} class="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40 {value === 'return' ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : value === 'deliver' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}">
							{text} ({picked[key].length}){#if money_} · {money(sum(rows, picked[key]))}{/if}
						</button>
					{/each}
				</div>
			</form>
		{/if}
	</section>
{/snippet}

<div class="grid gap-4 *:min-w-0 lg:grid-cols-2">
	{@render section('waiting', 'Pret postierin', PackageCheck, 'text-purple-600', data.waiting, 'Asnjë pako nuk pret postierin.', '?/advance', [['event', 'hand_over', 'Iu dhanë postierit']], false)}
	{@render section('courier', 'Te postieri', Truck, 'text-cyan-600', data.withCourier, 'Asnjë pako te postieri.', '?/advance', [['event', 'deliver', 'U dorëzuan'], ['event', 'return', 'U kthyen']], false)}
	{@render section('hand', 'Për dorëzim personal', Hand, 'text-amber-600', data.handReady, 'Asgjë për t’u dorëzuar me dorë.', '?/advance', [['event', 'deliver', 'U dorëzuan']], false)}
	{@render section('unpaid', 'Dorëzuar, pa u paguar', Wallet, 'text-emerald-600', data.unpaid, 'Të gjitha të dorëzuarat janë paguar.', '?/settle', [['go', 'settle', 'Posta i pagoi']], true)}
</div>
