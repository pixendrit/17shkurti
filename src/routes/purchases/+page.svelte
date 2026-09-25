<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import FormError from '$lib/components/FormError.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { busy } from '$lib/client/enhance';
	import { parseEuro } from '$lib/domain/money';
	import { monthKey } from '$lib/domain/time';
	import { COLORS, EXPENSE_FORM_CATEGORIES, GARMENTS, SIZES } from '$lib/domain/model';
	import { money, formatDate, dayInput, euroInput, monthLabel, field, label, primary, COLOR_LABELS, EXPENSE_LABELS, GARMENT_LABELS, PURCHASE_LABELS } from '$lib/ui';
	import Shirt from '@lucide/svelte/icons/shirt';
	import Printer from '@lucide/svelte/icons/printer';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let { data } = $props();
	type Kind = 'blanks' | 'dtf' | 'expense';
	let open = $state<Kind | null>(untrack(() => (['blanks', 'dtf', 'expense'].includes(data.kind ?? '') ? (data.kind as Kind) : null)));
	const today = dayInput(Math.floor(Date.now() / 1000));

	// Running totals, so the form says what it will record.
	let qty = $state<Record<string, string>>({});
	let unitCost = $state(untrack(() => euroInput(data.blankCost)));
	let sheets = $state('1');
	let sheetPrice = $state(untrack(() => euroInput(data.sheetPrice)));
	const pieces = $derived(SIZES.reduce((a, s) => a + (Number.parseInt(qty[s] ?? '', 10) || 0), 0));

	const months = $derived.by(() => {
		const m = new Map<string, typeof data.rows>();
		for (const r of data.rows) m.set(monthKey(r.date), [...(m.get(monthKey(r.date)) ?? []), r]);
		return [...m];
	});
	const icon = { blanks: Shirt, dtf: Printer, expense: Receipt };
	const reset = () => {
		open = null;
		qty = {};
	};
</script>

<svelte:head><title>Blerjet — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-slate-900">Blerjet</h1>
	<span class="text-sm text-slate-500">Gjithsej <span class="tabular font-semibold text-slate-900">{money(data.total)}</span></span>
</div>

<div class="mb-4 grid grid-cols-3 gap-2">
	{#each [['blanks', 'Bleva bluza'], ['dtf', 'Bleva DTF'], ['expense', 'Tjetër']] as const as [key, text] (key)}
		{@const Icon = icon[key]}
		<button onclick={() => (open = open === key ? null : key)} class="flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium {open === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}">
			<Icon class="size-5" />{text}
		</button>
	{/each}
</div>

<FormError />

{#if open}
	<form method="POST" action="?/record" use:enhance={busy({ after: reset })} class="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<input type="hidden" name="kind" value={open} />
		{#if open === 'blanks'}
			<p class="mb-3 text-xs text-slate-500">Bluzat shtohen në stok; kostoja e një bluze bëhet mesatarja e asaj që keni paguar.</p>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<label class="block"><span class={label}>Data</span><input type="date" name="date" value={today} class={field} /></label>
				<label class="block"><span class={label}>Bluza</span><select name="garment" class={field}>{#each GARMENTS as g (g)}<option value={g}>{GARMENT_LABELS[g]}</option>{/each}</select></label>
				<label class="block"><span class={label}>Ngjyra</span><select name="color" class={field}>{#each COLORS as c (c)}<option value={c}>{COLOR_LABELS[c]}</option>{/each}</select></label>
				<label class="block"><span class={label}>Çmimi për copë €</span><input name="unitCost" bind:value={unitCost} inputmode="decimal" class={field} /></label>
			</div>
			<p class="mb-1 mt-3 text-xs font-medium text-slate-600">Sa copë nga secila masë</p>
			<div class="grid grid-cols-6 gap-2">
				{#each SIZES as s (s)}
					<label class="block text-center"><span class="text-[11px] font-medium text-slate-500">{s}</span><input name="qty-{s}" bind:value={qty[s]} inputmode="numeric" placeholder="0" class="w-full rounded-lg border border-slate-300 px-1 py-1.5 text-center text-sm" /></label>
				{/each}
			</div>
			<p class="mt-3 text-sm text-slate-700">{pieces} copë · <span class="tabular font-semibold">{money(pieces * (parseEuro(unitCost) ?? 0))}</span></p>
		{:else if open === 'dtf'}
			<p class="mb-3 text-xs text-slate-500">Fleta 56 × 100 cm. Printimet që ishin në fletë shtohen në stok.</p>
			<div class="grid grid-cols-3 gap-3">
				<label class="block"><span class={label}>Data</span><input type="date" name="date" value={today} class={field} /></label>
				<label class="block"><span class={label}>Fletë</span><input name="sheets" bind:value={sheets} inputmode="numeric" class={field} /></label>
				<label class="block"><span class={label}>Çmimi për fletë €</span><input name="sheetPrice" bind:value={sheetPrice} inputmode="decimal" class={field} /></label>
			</div>
			<p class="mb-1 mt-3 text-xs font-medium text-slate-600">Printimet në këto fletë</p>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each data.prints as p (p.id)}
					<label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
						<input type="hidden" name="print" value={p.id} />
						<span class="min-w-0 flex-1 truncate text-sm">{p.name} <span class="text-xs text-slate-500">· {COLOR_LABELS[p.color].toLowerCase()}</span></span>
						<input name="qty-{p.id}" inputmode="numeric" placeholder="0" class="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm" />
					</label>
				{/each}
			</div>
			<p class="mt-3 text-sm text-slate-700"><span class="tabular font-semibold">{money((Number.parseInt(sheets, 10) || 0) * (parseEuro(sheetPrice) ?? 0))}</span></p>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<label class="block"><span class={label}>Data</span><input type="date" name="date" value={today} class={field} /></label>
				<label class="block"><span class={label}>Kategoria</span><select name="category" class={field}>{#each EXPENSE_FORM_CATEGORIES as c (c)}<option value={c}>{EXPENSE_LABELS[c]}</option>{/each}</select></label>
				<label class="block"><span class={label}>Shuma €</span><input name="amount" inputmode="decimal" required class={field} /></label>
			</div>
		{/if}
		<label class="mt-3 block"><span class={label}>Shënim</span><input name="note" placeholder={open === 'expense' ? 'p.sh. qese postare 100 copë' : ''} class={field} /></label>
		<button class="{primary} mt-3 w-full">Ruaj blerjen</button>
	</form>
{/if}

{#if data.rows.length === 0}
	<div class="rounded-xl border border-slate-200 bg-white"><Empty message="Ende asnjë blerje" hint="Regjistroni bluzat dhe fletët DTF që blini, që stoku dhe kostot të jenë të sakta." /></div>
{:else}
	<div class="space-y-4">
		{#each months as [month, rows] (month)}
			<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
				<header class="flex justify-between border-b border-slate-100 px-4 py-2.5 text-sm">
					<h2 class="font-semibold capitalize text-slate-900">{monthLabel(month)}</h2>
					<span class="tabular font-medium text-slate-700">{money(rows.reduce((a, r) => a + r.total, 0))}</span>
				</header>
				<ul class="divide-y divide-slate-100">
					{#each rows as r (r.id)}
						{@const Icon = icon[r.kind]}
						<li class="flex items-center gap-3 px-4 py-2.5">
							<Icon class="size-4 shrink-0 text-slate-400" />
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm text-slate-900">{r.note || PURCHASE_LABELS[r.kind]}{#if r.isDemo} <span class="text-[10px] text-slate-400">demo</span>{/if}</p>
								<p class="truncate text-xs text-slate-500">{formatDate(r.date)} · {r.summary}</p>
							</div>
							<span class="tabular text-sm font-medium">{money(r.total)}</span>
							<form method="POST" action="?/delete" use:enhance={busy({ confirm: 'Ta fshij këtë blerje? Stoku që shtoi hiqet.' })}>
								<input type="hidden" name="purchaseId" value={r.id} />
								<button aria-label="Fshi" class="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 class="size-3.5" /></button>
							</form>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}
