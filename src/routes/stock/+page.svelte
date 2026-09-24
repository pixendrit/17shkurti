<script lang="ts">
	import { PRODUCT_TYPES, SIZES, COLORS, money, productLabel, colorLabel } from '$lib/constants';
	import Empty from '$lib/components/Empty.svelte';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Printer from '@lucide/svelte/icons/printer';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';

	import { addBlank, setDtfStock, changeStock, receiveDtf, setOnOrder } from '$lib/client/actions';

	let { data } = $props();
	let tab = $state<'blanks' | 'dtf'>('blanks');
	let showAddBlank = $state(false);
	let showAddDtf = $state(false);
	let error = $state<string | null>(null);

	let nb = $state({ productType: PRODUCT_TYPES[0], color: COLORS[0], size: 'M', quantity: 0, unitCost: 0 });
	let nd = $state({ designId: '', quantity: 0, unitCost: 0 });
	let onOrderDraft = $state<Record<number, number>>({});

	async function submitBlank(e: Event) {
		e.preventDefault();
		error = await addBlank({ ...nb, quantity: Number(nb.quantity) || 0, unitCost: Number(nb.unitCost) || 0 });
		if (!error) showAddBlank = false;
	}

	async function submitDtf(e: Event) {
		e.preventDefault();
		if (!nd.designId) { error = 'Zgjidhni një dizajn.'; return; }
		error = await setDtfStock({
			designId: Number(nd.designId),
			quantity: Number(nd.quantity) || 0,
			unitCost: Number(nd.unitCost) || 0
		});
		if (!error) showAddDtf = false;
	}
</script>

<svelte:head><title>Stoku — Hijeshi</title></svelte:head>

<h1 class="mb-5 text-xl font-semibold text-slate-900">Stoku</h1>

{#if error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
{/if}

<!-- What the open order book demands that you don't have -->
{#if data.toBuy.length > 0 || data.toPrint.length > 0}
	<div class="mb-5 grid gap-3 sm:grid-cols-2">
		{#if data.toBuy.length > 0}
			<section class="rounded-xl border border-amber-200 bg-amber-50 p-4">
				<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
					<ShoppingCart class="size-4" /> Veshje pa print për të blerë
				</h2>
				<ul class="space-y-1 text-sm text-amber-900">
					{#each data.toBuy as b (`${b.productType}-${b.color}-${b.size}`)}
						<li class="flex justify-between gap-2">
							<span>{productLabel(b.productType)} · {colorLabel(b.color)} · {b.size}</span>
							<span class="tabular font-semibold">{b.short}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.toPrint.length > 0}
			<section class="rounded-xl border border-purple-200 bg-purple-50 p-4">
				<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-purple-900">
					<Printer class="size-4" /> DTF për të printuar
				</h2>
				<ul class="space-y-1 text-sm text-purple-900">
					{#each data.toPrint as t (t.designId)}
						<li class="flex justify-between gap-2">
							<span>{t.designName}</span>
							<span class="tabular font-semibold">{t.short}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{:else}
	<p class="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
		Keni gjithçka që u duhet porosive të hapura.
	</p>
{/if}

<div class="mb-4 flex gap-1">
	<button onclick={() => (tab = 'blanks')} class="rounded-lg px-3 py-1.5 text-sm font-medium {tab === 'blanks' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">
		Veshje pa print
	</button>
	<button onclick={() => (tab = 'dtf')} class="rounded-lg px-3 py-1.5 text-sm font-medium {tab === 'dtf' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">
		Printimet DTF
	</button>
</div>

{#if tab === 'blanks'}
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-900">Veshje pa print</h2>
			<button onclick={() => (showAddBlank = !showAddBlank)} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
				<Plus class="size-3.5" /> Shto
			</button>
		</header>

		{#if showAddBlank}
			<form onsubmit={submitBlank} class="grid gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-5">
				<select bind:value={nb.productType} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
					{#each PRODUCT_TYPES as p (p)}<option value={p}>{productLabel(p)}</option>{/each}
				</select>
				<select bind:value={nb.color} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
					{#each COLORS as c (c)}<option value={c}>{colorLabel(c)}</option>{/each}
				</select>
				<select bind:value={nb.size} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
					{#each SIZES as s (s)}<option value={s}>{s}</option>{/each}
				</select>
				<input bind:value={nb.quantity} type="number" min="0" placeholder="Sasia" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
				<div class="flex gap-2">
					<input bind:value={nb.unitCost} type="number" min="0" placeholder="Kosto" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
					<button class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Shto</button>
				</div>
			</form>
		{/if}

		{#if data.blanks.length === 0}
			<Empty message="Ende pa veshje në stok" hint="Shtoni masat dhe ngjyrat që mbani në shtëpi." />
		{:else}
			<div class="divide-y divide-slate-100">
				{#each data.blanks as b (b.id)}
					<div class="flex items-center justify-between gap-3 px-4 py-2.5">
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-slate-900">
								{productLabel(b.productType)} · {colorLabel(b.color)} · {b.size}
							</p>
							<p class="text-xs text-slate-500">{money(b.unitCost)} / copë</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="tabular w-10 text-right text-sm font-semibold {b.quantity <= b.lowStockAt ? 'text-amber-600' : 'text-slate-900'}">
								{b.quantity}
							</span>
							<div class="flex gap-1">
								<button onclick={() => changeStock('blank', b.id, -1)} aria-label="Hiq një" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Minus class="size-3.5" /></button>
								<button onclick={() => changeStock('blank', b.id, 1)} aria-label="Shto një" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Plus class="size-3.5" /></button>
								<button onclick={() => changeStock('blank', b.id, 10)} class="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium hover:bg-slate-50">+10</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{:else}
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-900">Printimet DTF</h2>
			<button onclick={() => (showAddDtf = !showAddDtf)} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
				<Plus class="size-3.5" /> Vendos stokun
			</button>
		</header>

		{#if showAddDtf}
			<form onsubmit={submitDtf} class="grid gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-4">
				<select bind:value={nd.designId} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2">
					<option value="">Zgjidhni dizajnin…</option>
					{#each data.designs as d (d.id)}<option value={String(d.id)}>{d.name}</option>{/each}
				</select>
				<input bind:value={nd.quantity} type="number" min="0" placeholder="Sasia" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
				<div class="flex gap-2">
					<input bind:value={nd.unitCost} type="number" min="0" placeholder="Kosto" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
					<button class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Ruaj</button>
				</div>
			</form>
		{/if}

		{#if data.dtf.length === 0}
			<Empty message="Ende pa printime DTF" hint="Shtoni fillimisht një dizajn, pastaj ndiqni këtu printimet e tij." />
		{:else}
			<div class="divide-y divide-slate-100">
				{#each data.dtf as d (d.id)}
					<div class="px-4 py-2.5">
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-slate-900">{d.designName}</p>
								<p class="text-xs text-slate-500">
									{money(d.unitCost)} / copë{#if d.onOrder > 0} · <span class="text-purple-600">{d.onOrder} te printeri</span>{/if}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="tabular w-10 text-right text-sm font-semibold {d.quantity <= d.lowStockAt ? 'text-amber-600' : 'text-slate-900'}">
									{d.quantity}
								</span>
								<div class="flex gap-1">
									<button onclick={() => changeStock('dtf', d.id, -1)} aria-label="Hiq një" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Minus class="size-3.5" /></button>
									<button onclick={() => changeStock('dtf', d.id, 1)} aria-label="Shto një" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Plus class="size-3.5" /></button>
								</div>
							</div>
						</div>

						<div class="mt-2 flex gap-2">
							<div class="flex gap-1">
								<input
									type="number"
									min="0"
									value={onOrderDraft[d.id] ?? d.onOrder}
									oninput={(e) => (onOrderDraft[d.id] = Number(e.currentTarget.value) || 0)}
									class="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
								/>
								<button onclick={() => setOnOrder(d.id, onOrderDraft[d.id] ?? d.onOrder)} class="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">
									Dërguar te printeri
								</button>
							</div>
							{#if d.onOrder > 0}
								<button onclick={() => receiveDtf(d.id)} class="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">
									U morën {d.onOrder}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}
