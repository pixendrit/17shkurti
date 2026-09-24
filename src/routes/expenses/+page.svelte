<script lang="ts">
	import { untrack } from 'svelte';
	import { money, formatDate, MONTHS, EXPENSE_LABELS, PRODUCT_TYPES, COLORS, SIZES, productLabel, colorLabel } from '$lib/constants';
	import Empty from '$lib/components/Empty.svelte';
	import Shirt from '@lucide/svelte/icons/shirt';
	import Printer from '@lucide/svelte/icons/printer';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { addExpense, buyBlanks, buyDtf, deleteExpense } from '$lib/client/actions';

	let { data } = $props();

	let open = $state<'blanks' | 'dtf' | 'other' | null>(null);
	let error = $state<string | null>(null);
	let saving = $state(false);

	const today = () => new Date().toISOString().slice(0, 10);
	/** A date input's day, as noon local time, so time zones never shift it a day. */
	const toTs = (d: string) => Math.floor(new Date(`${d}T12:00:00`).getTime() / 1000);

	// Form defaults come from Settings once, when the page opens.
	const s = untrack(() => data.settings);
	let b = $state({ date: today(), productType: PRODUCT_TYPES[0], color: COLORS[0], unitPrice: s.blankCost[PRODUCT_TYPES[0]] ?? 0, note: '' });
	let sizes = $state<Record<string, number>>(Object.fromEntries(SIZES.map((sz) => [sz, 0])));
	const blankQty = $derived(Object.values(sizes).reduce((a, q) => a + (Number(q) || 0), 0));

	let d = $state({ date: today(), sheets: 1, pricePerSheet: s.dtfSheetPrice, note: '' });
	let prints = $state<Record<string, number>>({});

	let x = $state({ date: today(), category: 'packaging', description: '', quantity: null as number | null, amount: null as number | null });

	async function save(fn: () => Promise<string | null>) {
		saving = true;
		error = null;
		try {
			error = await fn();
			if (!error) {
				open = null;
				sizes = Object.fromEntries(SIZES.map((sz) => [sz, 0]));
				prints = {};
				x.description = '';
				x.quantity = x.amount = null;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Nuk u ruajt.';
		} finally {
			saving = false;
		}
	}

	function monthLabel(key: string) {
		return `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
	}

	const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
	const label = 'mb-1 block text-xs font-medium text-slate-600';
</script>

<svelte:head><title>Shpenzimet — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-slate-900">Shpenzimet</h1>
	<span class="text-sm text-slate-500">Gjithsej <span class="tabular font-semibold text-slate-900">{money(data.total)}</span></span>
</div>

<div class="mb-4 grid grid-cols-3 gap-2">
	{#each [['blanks', 'Bleva bluza', Shirt], ['dtf', 'Bleva DTF', Printer], ['other', 'Tjetër', Receipt]] as const as [key, text, Icon] (key)}
		<button onclick={() => (open = open === key ? null : key)} class="flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium {open === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}">
			<Icon class="size-5" />{text}
		</button>
	{/each}
</div>

{#if error}<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>{/if}

{#if open === 'blanks'}
	<form onsubmit={(e) => { e.preventDefault(); save(() => buyBlanks({ ...b, date: toTs(b.date), unitPrice: Number(b.unitPrice), sizes: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, Number(v) || 0])) })); }} class="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<p class="mb-3 text-xs text-slate-500">Bluzat shtohen në stok dhe kostoja e tyre përditësohet.</p>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<label class="block"><span class={label}>Data</span><input type="date" bind:value={b.date} class={field} /></label>
			<label class="block"><span class={label}>Produkti</span>
				<select bind:value={b.productType} onchange={() => (b.unitPrice = s.blankCost[b.productType] ?? b.unitPrice)} class={field}>{#each PRODUCT_TYPES as p (p)}<option value={p}>{productLabel(p)}</option>{/each}</select>
			</label>
			<label class="block"><span class={label}>Ngjyra</span>
				<select bind:value={b.color} class={field}>{#each COLORS as c (c)}<option value={c}>{colorLabel(c)}</option>{/each}</select>
			</label>
			<label class="block"><span class={label}>Çmimi për copë €</span><input type="number" min="0" step="0.01" inputmode="decimal" bind:value={b.unitPrice} class={field} /></label>
		</div>
		<p class="mb-1 mt-3 text-xs font-medium text-slate-600">Sa copë për masë</p>
		<div class="grid grid-cols-6 gap-2">
			{#each SIZES as sz (sz)}
				<label class="block text-center"><span class="block text-[11px] text-slate-500">{sz}</span><input type="number" min="0" inputmode="numeric" bind:value={sizes[sz]} class="w-full rounded-lg border border-slate-300 px-1 py-1.5 text-center text-sm" /></label>
			{/each}
		</div>
		<div class="mt-3 flex items-center justify-between">
			<span class="text-sm text-slate-600">{blankQty} copë · <span class="tabular font-semibold text-slate-900">{money(blankQty * (Number(b.unitPrice) || 0))}</span></span>
			<button disabled={saving} class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Ruaj blerjen</button>
		</div>
	</form>
{:else if open === 'dtf'}
	<form onsubmit={(e) => { e.preventDefault(); save(() => buyDtf({ date: toTs(d.date), sheets: Number(d.sheets), pricePerSheet: Number(d.pricePerSheet), note: d.note, prints: Object.fromEntries(Object.entries(prints).map(([k, v]) => [k, Number(v) || 0])) })); }} class="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<p class="mb-3 text-xs text-slate-500">Fletë 56 × 100 cm. Printimet që vendosni më poshtë shtohen në stokun e DTF.</p>
		<div class="grid grid-cols-3 gap-3">
			<label class="block"><span class={label}>Data</span><input type="date" bind:value={d.date} class={field} /></label>
			<label class="block"><span class={label}>Fletë</span><input type="number" min="1" bind:value={d.sheets} class={field} /></label>
			<label class="block"><span class={label}>€ për fletë</span><input type="number" min="0" step="0.01" inputmode="decimal" bind:value={d.pricePerSheet} class={field} /></label>
		</div>
		{#if data.designs.length}
			<p class="mb-1 mt-3 text-xs font-medium text-slate-600">Printime të marra (para + pas = 1)</p>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each data.designs as des (des.id)}
					<label class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
						{des.name}
						<input type="number" min="0" inputmode="numeric" bind:value={prints[des.id]} placeholder="0" class="w-20 rounded-md border border-slate-300 px-2 py-1 text-center text-sm" />
					</label>
				{/each}
			</div>
		{/if}
		<label class="mt-3 block"><span class={label}>Shënim</span><input bind:value={d.note} placeholder="p.sh. përfshin 2 printime të personalizuara" class={field} /></label>
		<div class="mt-3 flex items-center justify-between">
			<span class="tabular text-sm font-semibold text-slate-900">{money((Number(d.sheets) || 0) * (Number(d.pricePerSheet) || 0))}</span>
			<button disabled={saving} class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Ruaj blerjen</button>
		</div>
	</form>
{:else if open === 'other'}
	<form onsubmit={(e) => { e.preventDefault(); save(() => addExpense({ date: toTs(x.date), category: x.category, description: x.description, quantity: x.quantity, amount: Number(x.amount) })); }} class="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<label class="block"><span class={label}>Data</span><input type="date" bind:value={x.date} class={field} /></label>
			<label class="block"><span class={label}>Kategoria</span>
				<select bind:value={x.category} class={field}>
					<option value="packaging">Paketim</option>
					<option value="marketing">Marketing / reklama</option>
					<option value="other">Tjetër</option>
				</select>
			</label>
			<label class="block"><span class={label}>Sasia</span><input type="number" min="0" bind:value={x.quantity} placeholder="opsionale" class={field} /></label>
			<label class="block"><span class={label}>Shuma €</span><input type="number" min="0" step="0.01" inputmode="decimal" bind:value={x.amount} required class={field} /></label>
			<label class="col-span-2 block sm:col-span-4"><span class={label}>Përshkrimi</span><input bind:value={x.description} placeholder="p.sh. 200 qese paketimi" class={field} /></label>
		</div>
		<div class="mt-3 flex justify-end"><button disabled={saving} class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Ruaj shpenzimin</button></div>
	</form>
{/if}

{#if data.months.length === 0}
	<section class="rounded-xl border border-slate-200 bg-white"><Empty message="Ende pa shpenzime" hint="Regjistroni çdo blerje bluzash, fletë DTF ose paketimi." /></section>
{:else}
	<div class="space-y-4">
		{#each data.months as m (m.month)}
			<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
				<header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
					<h2 class="text-sm font-semibold capitalize text-slate-900">{monthLabel(m.month)}</h2>
					<div class="flex flex-wrap gap-2 text-[11px] text-slate-500">
						{#each Object.entries(m.byCategory) as [cat, amt] (cat)}<span>{EXPENSE_LABELS[cat] ?? cat}: <span class="tabular font-medium text-slate-700">{money(amt)}</span></span>{/each}
						<span class="tabular font-semibold text-slate-900">= {money(m.total)}</span>
					</div>
				</header>
				<ul class="divide-y divide-slate-100">
					{#each m.rows as r (r.id)}
						<li class="flex items-center gap-3 px-4 py-2.5">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-900">
									{EXPENSE_LABELS[r.category] ?? r.category}
									{#if r.quantity}<span class="font-normal text-slate-500"> · {r.quantity} {r.category === 'dtf' ? 'fletë' : 'copë'}</span>{/if}
									{#if r.isDemo}<span class="ml-1 rounded bg-slate-100 px-1 text-[10px] font-normal text-slate-500">demo</span>{/if}
								</p>
								<p class="truncate text-xs text-slate-500">{formatDate(r.date)}{r.description ? ` · ${r.description}` : ''}</p>
							</div>
							<span class="tabular shrink-0 text-sm font-medium">{money(r.amount)}</span>
							<button onclick={() => confirm('Ta fshij këtë shpenzim?') && deleteExpense(r.id)} aria-label="Fshi" class="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 class="size-4" /></button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}
