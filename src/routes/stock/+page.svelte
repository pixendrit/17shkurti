<script lang="ts">
	import { PRODUCT_TYPES, SIZES, COLORS, money } from '$lib/constants';
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
		if (!nd.designId) { error = 'Pick a design.'; return; }
		error = await setDtfStock({
			designId: Number(nd.designId),
			quantity: Number(nd.quantity) || 0,
			unitCost: Number(nd.unitCost) || 0
		});
		if (!error) showAddDtf = false;
	}
</script>

<svelte:head><title>Stock — Hijeshi</title></svelte:head>

<h1 class="mb-5 text-xl font-semibold text-slate-900">Stock</h1>

{#if error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
{/if}

<!-- What the open order book demands that you don't have -->
{#if data.toBuy.length > 0 || data.toPrint.length > 0}
	<div class="mb-5 grid gap-3 sm:grid-cols-2">
		{#if data.toBuy.length > 0}
			<section class="rounded-xl border border-amber-200 bg-amber-50 p-4">
				<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
					<ShoppingCart class="size-4" /> Blanks to buy
				</h2>
				<ul class="space-y-1 text-sm text-amber-900">
					{#each data.toBuy as b (`${b.productType}-${b.color}-${b.size}`)}
						<li class="flex justify-between gap-2">
							<span>{b.productType} · {b.color} · {b.size}</span>
							<span class="tabular font-semibold">{b.short}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.toPrint.length > 0}
			<section class="rounded-xl border border-purple-200 bg-purple-50 p-4">
				<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-purple-900">
					<Printer class="size-4" /> DTF to print
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
		You have everything the open orders need.
	</p>
{/if}

<div class="mb-4 flex gap-1">
	<button onclick={() => (tab = 'blanks')} class="rounded-lg px-3 py-1.5 text-sm font-medium {tab === 'blanks' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">
		Blanks
	</button>
	<button onclick={() => (tab = 'dtf')} class="rounded-lg px-3 py-1.5 text-sm font-medium {tab === 'dtf' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">
		DTF transfers
	</button>
</div>

{#if tab === 'blanks'}
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-900">Blank garments</h2>
			<button onclick={() => (showAddBlank = !showAddBlank)} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
				<Plus class="size-3.5" /> Add
			</button>
		</header>

		{#if showAddBlank}
			<form onsubmit={submitBlank} class="grid gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-5">
				<select bind:value={nb.productType} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
					{#each PRODUCT_TYPES as p (p)}<option value={p}>{p}</option>{/each}
				</select>
				<select bind:value={nb.color} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
					{#each COLORS as c (c)}<option value={c}>{c}</option>{/each}
				</select>
				<select bind:value={nb.size} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
					{#each SIZES as s (s)}<option value={s}>{s}</option>{/each}
				</select>
				<input bind:value={nb.quantity} type="number" min="0" placeholder="Qty" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
				<div class="flex gap-2">
					<input bind:value={nb.unitCost} type="number" min="0" placeholder="Cost" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
					<button class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Add</button>
				</div>
			</form>
		{/if}

		{#if data.blanks.length === 0}
			<Empty message="No blanks tracked yet" hint="Add the sizes and colours you keep at home." />
		{:else}
			<div class="divide-y divide-slate-100">
				{#each data.blanks as b (b.id)}
					<div class="flex items-center justify-between gap-3 px-4 py-2.5">
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-slate-900">
								{b.productType} · {b.color} · {b.size}
							</p>
							<p class="text-xs text-slate-500">{money(b.unitCost)} each</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="tabular w-10 text-right text-sm font-semibold {b.quantity <= b.lowStockAt ? 'text-amber-600' : 'text-slate-900'}">
								{b.quantity}
							</span>
							<div class="flex gap-1">
								<button onclick={() => changeStock('blank', b.id, -1)} aria-label="Remove one" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Minus class="size-3.5" /></button>
								<button onclick={() => changeStock('blank', b.id, 1)} aria-label="Add one" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Plus class="size-3.5" /></button>
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
			<h2 class="text-sm font-semibold text-slate-900">DTF transfers</h2>
			<button onclick={() => (showAddDtf = !showAddDtf)} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
				<Plus class="size-3.5" /> Set stock
			</button>
		</header>

		{#if showAddDtf}
			<form onsubmit={submitDtf} class="grid gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-4">
				<select bind:value={nd.designId} class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2">
					<option value="">Pick a design…</option>
					{#each data.designs as d (d.id)}<option value={String(d.id)}>{d.name}</option>{/each}
				</select>
				<input bind:value={nd.quantity} type="number" min="0" placeholder="Qty" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
				<div class="flex gap-2">
					<input bind:value={nd.unitCost} type="number" min="0" placeholder="Cost" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
					<button class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Save</button>
				</div>
			</form>
		{/if}

		{#if data.dtf.length === 0}
			<Empty message="No transfers tracked yet" hint="Add a design first, then track its printed film here." />
		{:else}
			<div class="divide-y divide-slate-100">
				{#each data.dtf as d (d.id)}
					<div class="px-4 py-2.5">
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-slate-900">{d.designName}</p>
								<p class="text-xs text-slate-500">
									{money(d.unitCost)} each{#if d.onOrder > 0} · <span class="text-purple-600">{d.onOrder} at printer</span>{/if}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="tabular w-10 text-right text-sm font-semibold {d.quantity <= d.lowStockAt ? 'text-amber-600' : 'text-slate-900'}">
									{d.quantity}
								</span>
								<div class="flex gap-1">
									<button onclick={() => changeStock('dtf', d.id, -1)} aria-label="Remove one" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Minus class="size-3.5" /></button>
									<button onclick={() => changeStock('dtf', d.id, 1)} aria-label="Add one" class="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"><Plus class="size-3.5" /></button>
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
									Sent to printer
								</button>
							</div>
							{#if d.onOrder > 0}
								<button onclick={() => receiveDtf(d.id)} class="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">
									Received {d.onOrder}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}
