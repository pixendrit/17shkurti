<script lang="ts">
	import { untrack } from 'svelte';
	import { money, COUNTRY_LABELS, PRODUCT_TYPES, productLabel } from '$lib/constants';
	import { clearDemoData, saveCostSettings, setShirtsPerSheet } from '$lib/client/actions';

	let { data } = $props();

	// An editable copy taken once when the page opens, saved in one go.
	let s = $state(untrack(() => structuredClone(data.settings)));
	let perSheet = $state<Record<number, number>>(
		untrack(() => Object.fromEntries(data.designs.map((d) => [d.id, d.shirtsPerSheet])))
	);
	let msg = $state<{ ok: boolean; text: string } | null>(null);
	let saving = $state(false);

	async function save(e: Event) {
		e.preventDefault();
		saving = true;
		msg = null;
		try {
			const num = (v: unknown) => Number(v);
			const err = await saveCostSettings({
				defaultPrice: num(s.defaultPrice),
				dtfSheetPrice: num(s.dtfSheetPrice),
				customShirtsPerSheet: num(s.customShirtsPerSheet),
				laborPerShirt: num(s.laborPerShirt),
				packagingPerOrder: num(s.packagingPerOrder),
				blankCost: Object.fromEntries(Object.entries(s.blankCost).map(([k, v]) => [k, num(v)])),
				postCost: Object.fromEntries(Object.entries(s.postCost).map(([k, v]) => [k, num(v)]))
			});
			if (err) throw new Error(err);
			for (const d of data.designs) {
				if (Number(perSheet[d.id]) !== d.shirtsPerSheet) {
					const e2 = await setShirtsPerSheet(d.id, Number(perSheet[d.id]));
					if (e2) throw new Error(`${d.name}: ${e2}`);
				}
			}
			msg = { ok: true, text: 'U ruajt. Vlen për porositë e reja.' };
		} catch (err) {
			msg = { ok: false, text: err instanceof Error ? err.message : 'Nuk u ruajt.' };
		} finally {
			saving = false;
		}
	}

	async function clearDemo() {
		if (!confirm(`Të fshihen ${data.demo.orders} porosi dhe ${data.demo.expenses} shpenzime demo? Të dhënat reale nuk preken.`)) return;
		const res = await clearDemoData();
		msg = { ok: true, text: `U fshinë ${res.orders} porosi demo.` };
	}

	// One typical shirt, to show where the money goes with the numbers above.
	const exDesign = $derived(data.designs[0]);
	const ex = $derived.by(() => {
		const price = Number(s.defaultPrice) || 0;
		const blank = Number(s.blankCost[PRODUCT_TYPES[0]]) || 0;
		const dtf = (Number(s.dtfSheetPrice) || 0) / Math.max(1, Number(exDesign ? perSheet[exDesign.id] : 4) || 4);
		const labor = Number(s.laborPerShirt) || 0;
		const pack = Number(s.packagingPerOrder) || 0;
		const post = Number(s.postCost.XK) || 0;
		return { price, blank, dtf, labor, pack, post, profit: price - blank - dtf - labor - pack - post };
	});

	const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
	const label = 'mb-1 block text-xs font-medium text-slate-600';
</script>

<svelte:head><title>Cilësimet — Hijeshi</title></svelte:head>

<h1 class="mb-5 text-xl font-semibold text-slate-900">Cilësimet</h1>

<form onsubmit={save} class="space-y-4">
	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-1 text-sm font-semibold text-slate-900">Kostot</h2>
		<p class="mb-3 text-xs text-slate-500">Çdo porosi e ruan koston në momentin kur krijohet, kështu që ndryshimet këtu nuk prekin porositë e vjetra.</p>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<label class="block"><span class={label}>Çmimi standard i shitjes</span><input type="number" min="0" step="0.01" bind:value={s.defaultPrice} class={field} /></label>
			<label class="block"><span class={label}>Fletë DTF 56×100 cm</span><input type="number" min="0" step="0.01" bind:value={s.dtfSheetPrice} class={field} /></label>
			<label class="block"><span class={label}>Printime të personalizuara / fletë</span><input type="number" min="1" bind:value={s.customShirtsPerSheet} class={field} /></label>
			<label class="block"><span class={label}>Puna për bluzë</span><input type="number" min="0" step="0.01" bind:value={s.laborPerShirt} class={field} /></label>
			<label class="block"><span class={label}>Paketimi për pako</span><input type="number" min="0" step="0.01" bind:value={s.packagingPerOrder} class={field} /></label>
		</div>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-1 text-sm font-semibold text-slate-900">Bluzat pa print</h2>
		<p class="mb-3 text-xs text-slate-500">Përdoret derisa të regjistroni blerje; pas kësaj merret kostoja mesatare e blerjeve.</p>
		<div class="grid grid-cols-2 gap-3">
			{#each PRODUCT_TYPES as p (p)}
				<label class="block"><span class={label}>{productLabel(p)}</span><input type="number" min="0" step="0.01" bind:value={s.blankCost[p]} class={field} /></label>
			{/each}
		</div>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-1 text-sm font-semibold text-slate-900">Posta na kushton</h2>
		<p class="mb-3 text-xs text-slate-500">Për klientin transporti është falas; këto janë kostot tona për pako.</p>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each Object.keys(COUNTRY_LABELS) as c (c)}
				<label class="block"><span class={label}>{COUNTRY_LABELS[c]}</span><input type="number" min="0" step="0.01" bind:value={s.postCost[c]} class={field} /></label>
			{/each}
		</div>
	</section>

	{#if data.designs.length}
		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 class="mb-1 text-sm font-semibold text-slate-900">Sa bluza del nga një fletë DTF</h2>
			<p class="mb-3 text-xs text-slate-500">Para + pas e një bluze. Kostoja DTF për bluzë = çmimi i fletës ÷ ky numër.</p>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each data.designs as d (d.id)}
					<label class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
						<span>{d.name} <span class="text-xs text-slate-500">· {money((Number(s.dtfSheetPrice) || 0) / Math.max(1, Number(perSheet[d.id]) || 1))} / bluzë</span></span>
						<input type="number" min="1" max="100" bind:value={perSheet[d.id]} class="w-20 rounded-md border border-slate-300 px-2 py-1 text-center" />
					</label>
				{/each}
			</div>
		</section>
	{/if}

	<section class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
		<h2 class="mb-2 text-sm font-semibold text-emerald-900">Një bluzë {money(ex.price)}, me postë në Kosovë</h2>
		<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-emerald-900 sm:grid-cols-3">
			<div class="flex justify-between"><dt>Bluza</dt><dd class="tabular">{money(ex.blank)}</dd></div>
			<div class="flex justify-between"><dt>DTF{exDesign ? ` (${exDesign.name})` : ''}</dt><dd class="tabular">{money(ex.dtf)}</dd></div>
			<div class="flex justify-between"><dt>Puna</dt><dd class="tabular">{money(ex.labor)}</dd></div>
			<div class="flex justify-between"><dt>Paketimi</dt><dd class="tabular">{money(ex.pack)}</dd></div>
			<div class="flex justify-between"><dt>Posta</dt><dd class="tabular">{money(ex.post)}</dd></div>
			<div class="flex justify-between font-semibold"><dt>Fitimi</dt><dd class="tabular">{money(ex.profit)}</dd></div>
		</dl>
	</section>

	{#if msg}<p class="rounded-lg px-3 py-2 text-sm {msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}">{msg.text}</p>{/if}
	<button disabled={saving} class="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Duke ruajtur…' : 'Ruaj cilësimet'}</button>
</form>

{#if data.demo.orders || data.demo.expenses}
	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="text-sm font-semibold text-slate-900">Të dhënat demo</h2>
		<p class="mt-1 text-xs text-slate-500">
			{data.demo.orders} porosi dhe {data.demo.expenses} shpenzime janë shembuj. Porositë reale (p.sh. të importuara nga posta) nuk preken.
		</p>
		<button onclick={clearDemo} class="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Fshi të dhënat demo</button>
	</section>
{/if}
