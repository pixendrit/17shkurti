<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import DesignThumb from '$lib/components/DesignThumb.svelte';
	import {
		money,
		formatDate,
		statusLabel,
		productLabel,
		colorLabel,
		CHANNEL_LABELS,
		COUNTRY_LABELS,
		DELIVERY_LABELS,
		PAYMENT_METHOD_LABELS
	} from '$lib/constants';
	import Phone from '@lucide/svelte/icons/phone';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Copy from '@lucide/svelte/icons/copy';
	import Gift from '@lucide/svelte/icons/gift';
	import Pencil from '@lucide/svelte/icons/pencil';
	import {
		deleteOrder,
		editOrder,
		markAsMade,
		setCustomPrintReady,
		setOrderStatus,
		setPaymentStatus
	} from '$lib/client/actions';

	let { data } = $props();
	let error = $state<string | null>(null);
	let copied = $state(false);
	let editing = $state(false);

	const o = $derived(data.order);
	const flow = $derived(
		o.deliveryMethod === 'post'
			? ['new', 'in_production', 'ready', 'shipped', 'delivered']
			: ['new', 'in_production', 'ready', 'delivered']
	);

	async function run(fn: () => Promise<unknown>) {
		error = null;
		try {
			const res = await fn();
			if (typeof res === 'string') error = res;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Diçka shkoi keq.';
		}
	}

	async function remove() {
		if (confirm('Ta fshij përgjithmonë këtë porosi?')) await deleteOrder(o.id);
	}

	/** One tap to copy the whole address block for the courier. */
	async function copyAddress() {
		const text = [o.customerName, o.phone, o.address, [o.city, COUNTRY_LABELS[o.country]].filter(Boolean).join(', ')]
			.filter(Boolean)
			.join('\n');
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}

	// Edit form, seeded from the order each time it opens.
	let f = $state({} as Record<string, string | number>);
	function openEdit() {
		f = {
			customerName: o.customerName,
			phone: o.phone,
			address: o.address ?? '',
			city: o.city ?? '',
			country: o.country,
			channel: o.channel,
			kind: o.kind,
			deliveryMethod: o.deliveryMethod,
			paymentMethod: o.paymentMethod,
			shippingFee: o.shippingFee,
			shippingCost: o.shippingCost,
			discount: o.discount,
			trackingRef: o.trackingRef ?? '',
			notes: o.notes ?? ''
		};
		editing = true;
	}
	async function saveEdit(e: Event) {
		e.preventDefault();
		await run(() => editOrder(o.id, f as never));
		if (!error) editing = false;
	}

	const costLines = $derived([
		['Bluza pa print', data.econ.blank],
		['DTF', data.econ.dtf],
		['Puna', data.econ.labor],
		['Paketimi', data.econ.packaging],
		[o.deliveryMethod === 'post' ? 'Posta' : 'Dorëzimi', data.econ.shipping]
	] as const);

	const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
	const label = 'mb-1 block text-xs font-medium text-slate-600';
</script>

<svelte:head><title>{o.code} — Hijeshi</title></svelte:head>

<div class="mb-5 flex flex-wrap items-center gap-2">
	<a href="/orders" class="text-sm text-slate-500 hover:text-slate-900">← Porositë</a>
	<h1 class="text-xl font-semibold text-slate-900">{o.code}</h1>
	<StatusBadge status={o.status} delivery={o.deliveryMethod} />
	{#if o.kind === 'gift'}
		<span class="inline-flex items-center gap-1 rounded bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700"><Gift class="size-3" /> Dhuratë</span>
	{:else if o.paymentStatus === 'paid'}
		<span class="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">E paguar</span>
	{:else}
		<span class="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">E papaguar</span>
	{/if}
	{#if o.isDemo}<span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">demo</span>{/if}
</div>

{#if error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
{/if}

<div class="grid gap-4 *:min-w-0 lg:grid-cols-3">
	<div class="space-y-4 lg:col-span-2">
		{#if editing}
			<form onsubmit={saveEdit} class="rounded-xl border border-slate-900 bg-white p-4 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold text-slate-900">Ndrysho porosinë</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block"><span class={label}>Emri</span><input bind:value={f.customerName} class={field} /></label>
					<label class="block"><span class={label}>Telefoni</span><input bind:value={f.phone} class={field} /></label>
					<label class="block sm:col-span-2"><span class={label}>Adresa</span><input bind:value={f.address} class={field} /></label>
					<label class="block"><span class={label}>Qyteti</span><input bind:value={f.city} class={field} /></label>
					<label class="block"><span class={label}>Shteti</span>
						<select bind:value={f.country} class={field}>{#each Object.entries(COUNTRY_LABELS) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select>
					</label>
					<label class="block"><span class={label}>Burimi</span>
						<select bind:value={f.channel} class={field}>{#each Object.entries(CHANNEL_LABELS) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select>
					</label>
					<label class="block"><span class={label}>Lloji</span>
						<select bind:value={f.kind} class={field}><option value="sale">Shitje</option><option value="gift">Dhuratë / influencer</option></select>
					</label>
					<label class="block"><span class={label}>Dërgesa</span>
						<select bind:value={f.deliveryMethod} class={field}>{#each Object.entries(DELIVERY_LABELS) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select>
					</label>
					<label class="block"><span class={label}>Nr. i dërgesës</span><input bind:value={f.trackingRef} class={field} /></label>
					<label class="block"><span class={label}>Posta/dorëzimi na kushton</span><input type="number" min="0" step="0.01" bind:value={f.shippingCost} class={field} /></label>
					<label class="block"><span class={label}>Transport nga klienti</span><input type="number" min="0" step="0.01" bind:value={f.shippingFee} class={field} /></label>
					<label class="block"><span class={label}>Zbritja</span><input type="number" min="0" step="0.01" bind:value={f.discount} class={field} /></label>
					<label class="block"><span class={label}>Mënyra e pagesës</span>
						<select bind:value={f.paymentMethod} class={field}>{#each Object.entries(PAYMENT_METHOD_LABELS) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select>
					</label>
					<label class="block sm:col-span-2"><span class={label}>Shënime</span><textarea bind:value={f.notes} rows="2" class={field}></textarea></label>
				</div>
				<div class="mt-3 flex gap-2">
					<button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ruaj</button>
					<button type="button" onclick={() => (editing = false)} class="rounded-lg border border-slate-300 px-4 py-2 text-sm">Anulo</button>
				</div>
			</form>
		{:else}
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 class="font-semibold text-slate-900">{o.customerName}</h2>
						<p class="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
							<Phone class="size-3.5" /><a href="tel:{o.phone}" class="hover:underline">{o.phone}</a>
						</p>
						<p class="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
							<MapPin class="mt-0.5 size-3.5 shrink-0" />
							<span>{[o.address, o.city, COUNTRY_LABELS[o.country]].filter(Boolean).join(', ')}</span>
						</p>
						<p class="mt-2 text-xs text-slate-500">
							{CHANNEL_LABELS[o.channel] ?? o.channel} · {DELIVERY_LABELS[o.deliveryMethod]} · {formatDate(o.createdAt)}
							{#if o.kind === 'sale'} · {PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}{/if}
						</p>
						{#if o.trackingRef}<p class="mt-1 text-xs text-slate-500">Nr. i dërgesës: <span class="font-mono">{o.trackingRef}</span></p>{/if}
						{#if o.shippedAt || o.deliveredAt || o.paidAt}
							<p class="mt-1 text-xs text-slate-500">
								{#if o.shippedAt}Te postieri {formatDate(o.shippedAt)}{/if}
								{#if o.deliveredAt} · Dorëzuar {formatDate(o.deliveredAt)}{/if}
								{#if o.paidAt && o.kind === 'sale'} · Paguar {formatDate(o.paidAt)}{/if}
							</p>
						{/if}
					</div>
					<div class="flex shrink-0 flex-col gap-1.5">
						<button onclick={copyAddress} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
							<Copy class="size-3.5" /> {copied ? 'U kopjua' : 'Kopjo'}
						</button>
						<button onclick={openEdit} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
							<Pencil class="size-3.5" /> Ndrysho
						</button>
					</div>
				</div>
				{#if o.notes}<p class="mt-3 whitespace-pre-line rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{o.notes}</p>{/if}
			</section>
		{/if}

		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Artikujt</h2></header>
			<div class="divide-y divide-slate-100">
				{#each data.items as item (item.id)}
					<div class="px-4 py-3">
						<div class="flex items-start gap-3">
							{#if item.designId && !item.isCustom}
								<DesignThumb designId={item.designId} images={item.images} side="back" size="size-14" alt={item.designName ?? ''} />
							{/if}
							<div class="min-w-0 flex-1">
								<p class="font-medium text-slate-900">
									{item.quantity}× {productLabel(item.productType)} · {colorLabel(item.color)} · {item.size}
								</p>
								<p class="text-sm {item.isCustom ? 'font-medium text-violet-700' : 'text-slate-500'}">
									{item.isCustom ? 'Print i personalizuar' : (item.designName ?? 'Pa print')}
								</p>
								{#if o.stockDeductedAt}
									<p class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-400"><CircleCheck class="size-3.5" /> E bërë — stoku u zbrit</p>
								{:else if item.readiness.ready}
									<p class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CircleCheck class="size-3.5" /> Gjithçka në stok</p>
								{:else}
									<p class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
										<TriangleAlert class="size-3.5" />
										{#if item.readiness.needBlanks > 0}Bli {item.readiness.needBlanks} veshje pa print{/if}
										{#if item.readiness.needBlanks > 0 && item.readiness.needTransfers > 0}·{/if}
										{#if item.readiness.needTransfers > 0}{item.isCustom ? 'Printo DTF-në e personalizuar' : `Printo ${item.readiness.needTransfers} DTF`}{/if}
									</p>
								{/if}
							</div>
							<p class="tabular shrink-0 text-sm font-medium text-slate-700">{o.kind === 'gift' ? 'Falas' : money(item.quantity * item.unitPrice)}</p>
						</div>

						{#if item.isCustom}
							<div class="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
								{#each [['front', 'Para'], ['back', 'Pas']] as [side, text] (side)}
									{@const v = item.mockups[side as 'front' | 'back']}
									{#if v}
										<a href="/api/item-image/{item.id}/{side}?v={v}" target="_blank" class="block">
											<img src="/api/item-image/{item.id}/{side}?v={v}" alt="Mockup {text.toLowerCase()}" class="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
											<span class="mt-0.5 block text-center text-[11px] text-slate-500">Mockup {text.toLowerCase()}</span>
										</a>
									{/if}
								{/each}
							</div>
							{#if !o.stockDeductedAt}
								<label class="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
									<input type="checkbox" checked={item.customPrintReady} onchange={(e) => run(() => setCustomPrintReady(item.id, e.currentTarget.checked))} class="size-4 rounded border-slate-300" />
									Printi DTF i personalizuar ka ardhur
								</label>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			<!-- Where the money of this order goes. -->
			<div class="space-y-1 border-t border-slate-100 px-4 py-3 text-sm">
				{#if o.kind === 'sale'}
					<div class="flex justify-between text-slate-600"><span>Nëntotali</span><span class="tabular">{money(data.econ.subtotal)}</span></div>
					{#if o.shippingFee}<div class="flex justify-between text-slate-600"><span>Transport nga klienti</span><span class="tabular">{money(o.shippingFee)}</span></div>{/if}
					{#if o.discount}<div class="flex justify-between text-slate-600"><span>Zbritja</span><span class="tabular">−{money(o.discount)}</span></div>{/if}
					<div class="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900"><span>Të ardhurat</span><span class="tabular">{money(data.econ.revenue)}</span></div>
				{/if}
				{#each costLines as [name, v] (name)}
					<div class="flex justify-between text-xs text-slate-500"><span>− {name}</span><span class="tabular">{money(v)}</span></div>
				{/each}
				<div class="flex justify-between border-t border-slate-100 pt-1 text-sm font-semibold {data.econ.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
					<span>{o.kind === 'gift' ? 'Kosto marketingu' : o.status === 'returned' ? 'Humbja nga kthimi' : 'Fitimi'}</span>
					<span class="tabular">{money(o.kind === 'gift' ? data.econ.cost : data.econ.profit)}</span>
				</div>
				{#if o.status === 'cancelled'}<p class="text-xs text-slate-400">E anuluar: nuk llogaritet në statistika.</p>{/if}
			</div>
		</section>
	</div>

	<div class="space-y-4">
		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-sm font-semibold text-slate-900">Statusi</h2>
			<div class="grid grid-cols-2 gap-2">
				{#each flow as st (st)}
					<button
						onclick={() => run(() => setOrderStatus(o.id, st))}
						disabled={o.status === st}
						class="w-full rounded-lg border px-2 py-2 text-xs font-medium {o.status === st ? 'cursor-default border-slate-900 bg-slate-900 text-white' : 'border-slate-300 hover:bg-slate-50'}"
					>
						{statusLabel(st, o.deliveryMethod)}
					</button>
				{/each}
			</div>
			<div class="mt-2 grid grid-cols-2 gap-2">
				{#if o.deliveryMethod === 'post'}
					<button onclick={() => run(() => setOrderStatus(o.id, 'returned'))} disabled={o.status === 'returned'} class="rounded-lg border border-rose-200 px-2 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:bg-rose-600 disabled:text-white">
						E kthyer
					</button>
				{/if}
				<button onclick={() => run(() => setOrderStatus(o.id, 'cancelled'))} disabled={o.status === 'cancelled'} class="rounded-lg border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:bg-red-600 disabled:text-white {o.deliveryMethod === 'post' ? '' : 'col-span-2'}">
					Anulo porosinë
				</button>
			</div>
		</section>

		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-sm font-semibold text-slate-900">Stoku</h2>
			{#if o.stockDeductedAt}
				<p class="text-sm text-slate-500">Stoku për këtë porosi është zbritur tashmë.</p>
			{:else}
				<button onclick={() => run(() => markAsMade(o.id))} disabled={!data.ready} class="w-full rounded-lg px-3 py-2.5 text-sm font-semibold {data.ready ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'}">
					{data.ready ? 'Shëno si të bërë' : 'Mungon stoku'}
				</button>
				<p class="mt-2 text-xs text-slate-500">
					{data.ready ? 'Zbret veshjet dhe printimet DTF nga stoku.' : 'Shikoni faqen Stoku për çfarë duhet blerë ose printuar.'}
				</p>
			{/if}
		</section>

		{#if o.kind === 'sale'}
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold text-slate-900">Pagesa</h2>
				<button onclick={() => run(() => setPaymentStatus(o.id, o.paymentStatus === 'paid' ? 'unpaid' : 'paid'))} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
					{o.paymentStatus === 'paid' ? 'Shëno si të papaguar' : 'Shëno si të paguar'}
				</button>
			</section>
		{/if}

		<button onclick={remove} class="w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-600">Fshi porosinë</button>
	</div>
</div>
