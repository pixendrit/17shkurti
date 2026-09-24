<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import FormError from '$lib/components/FormError.svelte';
	import { busy } from '$lib/client/enhance';
	import { divide, parseEuro } from '$lib/domain/money';
	import { COUNTRIES, GARMENTS } from '$lib/domain/model';
	import { money, euroInput, field, label, COUNTRY_LABELS, GARMENT_LABELS } from '$lib/ui';

	let { data, form } = $props();

	// The fields as typed, so the example below follows along.
	const s0 = untrack(() => data.settings);
	let v = $state({
		defaultPrice: euroInput(s0.defaultPrice),
		sheetPrice: euroInput(s0.sheetPrice),
		customPerSheet: String(s0.customPerSheet),
		laborPerShirt: euroInput(s0.laborPerShirt),
		packagingPerOrder: euroInput(s0.packagingPerOrder),
		blank: Object.fromEntries(GARMENTS.map((g) => [g, euroInput(s0.blankCost[g])])),
		courier: Object.fromEntries(COUNTRIES.map((c) => [c, euroInput(s0.courierCost[c])]))
	});
	const e = (t: string) => parseEuro(t) ?? 0;
	const ex = $derived.by(() => {
		const price = e(v.defaultPrice);
		const blank = data.boughtCost.oversized_200g ?? e(v.blank.oversized_200g);
		const dtf = divide(e(v.sheetPrice), data.perSheet);
		const labor = e(v.laborPerShirt);
		const pack = e(v.packagingPerOrder);
		const post = e(v.courier.XK);
		return { price, blank, dtf, labor, pack, post, profit: price - blank - dtf - labor - pack - post };
	});
	let saved = $state(false);
</script>

<svelte:head><title>Cilësimet — Hijeshi</title></svelte:head>

<h1 class="mb-5 text-xl font-semibold text-slate-900">Cilësimet</h1>

<FormError />

<form method="POST" action="?/save" use:enhance={busy({ reset: false, after: () => (saved = !form?.error) })} oninput={() => (saved = false)} class="space-y-4">
	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-1 text-sm font-semibold text-slate-900">Kostot</h2>
		<p class="mb-3 text-xs text-slate-500">Çdo porosi e ruan koston kur merret, kështu që ndryshimet këtu nuk prekin porositë e vjetra.</p>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<label class="block"><span class={label}>Çmimi i zakonshëm i shitjes €</span><input name="defaultPrice" bind:value={v.defaultPrice} inputmode="decimal" class={field} /></label>
			<label class="block"><span class={label}>Fletë DTF 56×100 cm €</span><input name="sheetPrice" bind:value={v.sheetPrice} inputmode="decimal" class={field} /></label>
			<label class="block"><span class={label}>Printime të personalizuara / fletë</span><input name="customPerSheet" bind:value={v.customPerSheet} inputmode="numeric" class={field} /></label>
			<label class="block"><span class={label}>Puna për bluzë €</span><input name="laborPerShirt" bind:value={v.laborPerShirt} inputmode="decimal" class={field} /></label>
			<label class="block"><span class={label}>Paketimi për pako €</span><input name="packagingPerOrder" bind:value={v.packagingPerOrder} inputmode="decimal" class={field} /></label>
		</div>
		<p class="mt-2 text-xs text-slate-500">Sa printime të një dizajni dalin nga një fletë vendoset te Dizajnet.</p>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-1 text-sm font-semibold text-slate-900">Bluzat pa print</h2>
		<p class="mb-3 text-xs text-slate-500">Përdoret derisa të regjistroni blerje; pas kësaj merret mesatarja e asaj që keni paguar.</p>
		<div class="grid grid-cols-2 gap-3">
			{#each GARMENTS as g (g)}
				<label class="block">
					<span class={label}>{GARMENT_LABELS[g]} €</span>
					<input name="blank-{g}" bind:value={v.blank[g]} inputmode="decimal" class={field} />
					{#if data.boughtCost[g] != null}<span class="mt-1 block text-xs text-emerald-700">Nga blerjet: {money(data.boughtCost[g])} / copë</span>{/if}
				</label>
			{/each}
		</div>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-1 text-sm font-semibold text-slate-900">Posta na kushton</h2>
		<p class="mb-3 text-xs text-slate-500">Për klientin transporti është falas; këto janë kostot tona për pako.</p>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each COUNTRIES as c (c)}
				<label class="block"><span class={label}>{COUNTRY_LABELS[c]} €</span><input name="courier-{c}" bind:value={v.courier[c]} inputmode="decimal" class={field} /></label>
			{/each}
		</div>
	</section>

	<section class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
		<h2 class="mb-2 text-sm font-semibold text-emerald-900">Një bluzë oversized {money(ex.price)}, me postë në Kosovë</h2>
		<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-emerald-900 sm:grid-cols-3">
			<div class="flex justify-between"><dt>Bluza</dt><dd class="tabular">{money(ex.blank)}</dd></div>
			<div class="flex justify-between"><dt>DTF ({data.perSheet}/fletë)</dt><dd class="tabular">{money(ex.dtf)}</dd></div>
			<div class="flex justify-between"><dt>Puna</dt><dd class="tabular">{money(ex.labor)}</dd></div>
			<div class="flex justify-between"><dt>Paketimi</dt><dd class="tabular">{money(ex.pack)}</dd></div>
			<div class="flex justify-between"><dt>Posta</dt><dd class="tabular">{money(ex.post)}</dd></div>
			<div class="flex justify-between font-semibold"><dt>Fitimi</dt><dd class="tabular">{money(ex.profit)}</dd></div>
		</dl>
	</section>

	{#if saved}<p class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">U ruajt. Vlen për porositë e reja.</p>{/if}
	<button class="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Ruaj cilësimet</button>
</form>

{#if data.demo.orders || data.demo.purchases}
	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="text-sm font-semibold text-slate-900">Të dhënat demo</h2>
		<p class="mt-1 text-xs text-slate-500">{data.demo.orders} porosi dhe {data.demo.purchases} blerje janë shembuj. Të dhënat reale nuk preken.</p>
		<form method="POST" action="?/clearDemo" use:enhance={busy({ confirm: `Të fshihen ${data.demo.orders} porosi dhe ${data.demo.purchases} blerje demo?` })}>
			<button class="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Fshi të dhënat demo</button>
		</form>
	</section>
{/if}
