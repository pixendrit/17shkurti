<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { money, formatDate, CHANNEL_LABELS, STATUS_LABELS, productLabel, colorLabel, PAYMENT_METHOD_LABELS } from '$lib/constants';
	import Phone from '@lucide/svelte/icons/phone';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Copy from '@lucide/svelte/icons/copy';

	import { base } from '$app/paths';
	import { deleteOrder, markAsMade, setOrderStatus, setPaymentStatus } from '$lib/client/actions';

	let { data } = $props();
	let error = $state<string | null>(null);

	async function make() {
		error = await markAsMade(data.order.id);
	}

	async function remove() {
		if (confirm('Ta fshij përgjithmonë këtë porosi?')) await deleteOrder(data.order.id);
	}

	const flow = ['new', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered'];
	let copied = $state(false);

	/** One tap to copy the whole address block for the courier. */
	async function copyAddress() {
		const o = data.order;
		const text = [o.customerName, o.phone, o.address, o.city].filter(Boolean).join('\n');
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head><title>{data.order.code} — Hijeshi</title></svelte:head>

<div class="mb-5 flex flex-wrap items-center gap-3">
	<a href="{base}/orders" class="text-sm text-slate-500 hover:text-slate-900">← Porositë</a>
	<h1 class="text-xl font-semibold text-slate-900">{data.order.code}</h1>
	<StatusBadge status={data.order.status} />
	{#if data.order.paymentStatus === 'paid'}
		<span class="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">E paguar</span>
	{:else}
		<span class="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">E papaguar</span>
	{/if}
</div>

{#if error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
{/if}

<div class="grid gap-4 lg:grid-cols-3">
	<div class="space-y-4 lg:col-span-2">
		<!-- Customer -->
		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="font-semibold text-slate-900">{data.order.customerName}</h2>
					<p class="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
						<Phone class="size-3.5" />
						<a href="tel:{data.order.phone}" class="hover:underline">{data.order.phone}</a>
					</p>
					{#if data.order.address}
						<p class="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
							<MapPin class="mt-0.5 size-3.5 shrink-0" />
							<span>{data.order.address}{data.order.city ? `, ${data.order.city}` : ''}</span>
						</p>
					{/if}
					<p class="mt-2 text-xs text-slate-400">
						{CHANNEL_LABELS[data.order.channel] ?? data.order.channel} · {formatDate(data.order.createdAt)} · {PAYMENT_METHOD_LABELS[data.order.paymentMethod] ?? data.order.paymentMethod}
					</p>
				</div>
				<button onclick={copyAddress} class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
					<Copy class="size-3.5" /> {copied ? 'U kopjua' : 'Kopjo'}
				</button>
			</div>
			{#if data.order.notes}
				<p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{data.order.notes}</p>
			{/if}
		</section>

		<!-- Items + what's missing -->
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3">
				<h2 class="text-sm font-semibold text-slate-900">Artikujt</h2>
			</header>
			<div class="divide-y divide-slate-100">
				{#each data.items as item (item.id)}
					<div class="flex items-start justify-between gap-3 px-4 py-3">
						<div class="min-w-0">
							<p class="font-medium text-slate-900">
								{item.quantity}× {productLabel(item.productType)} · {colorLabel(item.color)} · {item.size}
							</p>
							<p class="text-sm text-slate-500">{item.designName ?? 'Pa print'}</p>

							{#if data.order.stockDeductedAt}
								<p class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-400">
									<CircleCheck class="size-3.5" /> E bërë — stoku u zbrit
								</p>
							{:else if item.readiness.ready}
								<p class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
									<CircleCheck class="size-3.5" /> Gjithçka në stok
								</p>
							{:else}
								<p class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
									<TriangleAlert class="size-3.5" />
									{#if item.readiness.needBlanks > 0}
										Bli {item.readiness.needBlanks} veshje pa print
									{/if}
									{#if item.readiness.needBlanks > 0 && item.readiness.needTransfers > 0}·{/if}
									{#if item.readiness.needTransfers > 0}
										Printo {item.readiness.needTransfers} DTF
									{/if}
								</p>
							{/if}
						</div>
						<p class="tabular shrink-0 text-sm font-medium text-slate-700">
							{money(item.quantity * item.unitPrice)}
						</p>
					</div>
				{/each}
			</div>
			<div class="space-y-1 border-t border-slate-100 px-4 py-3 text-sm">
				<div class="flex justify-between text-slate-600"><span>Nëntotali</span><span class="tabular">{money(data.subtotal)}</span></div>
				{#if data.order.shippingFee}
					<div class="flex justify-between text-slate-600"><span>Transporti</span><span class="tabular">{money(data.order.shippingFee)}</span></div>
				{/if}
				{#if data.order.discount}
					<div class="flex justify-between text-slate-600"><span>Zbritja</span><span class="tabular">−{money(data.order.discount)}</span></div>
				{/if}
				<div class="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
					<span>Totali</span><span class="tabular">{money(data.total)}</span>
				</div>
				<div class="flex justify-between text-xs text-slate-400">
					<span>Kosto / fitimi i përafërt</span>
					<span class="tabular">{money(data.cost)} / {money(data.total - data.cost)}</span>
				</div>
			</div>
		</section>
	</div>

	<!-- Actions -->
	<div class="space-y-4">
		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-sm font-semibold text-slate-900">Kalo në</h2>
			<div class="grid grid-cols-2 gap-2">
				{#each flow as s (s)}
					<button
						onclick={() => setOrderStatus(data.order.id, s)}
						disabled={data.order.status === s}
						class="w-full rounded-lg border px-2 py-2 text-xs font-medium
						{data.order.status === s
							? 'cursor-default border-slate-900 bg-slate-900 text-white'
							: 'border-slate-300 hover:bg-slate-50'}"
					>
						{STATUS_LABELS[s]}
					</button>
				{/each}
			</div>

			<button onclick={() => setOrderStatus(data.order.id, 'cancelled')} class="mt-2 w-full rounded-lg border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
				Anulo porosinë
			</button>
		</section>

		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-sm font-semibold text-slate-900">Stoku</h2>
			{#if data.order.stockDeductedAt}
				<p class="text-sm text-slate-500">Stoku për këtë porosi është zbritur tashmë.</p>
			{:else}
				<button
					onclick={make}
					disabled={!data.ready}
					class="w-full rounded-lg px-3 py-2.5 text-sm font-semibold
					{data.ready
						? 'bg-emerald-600 text-white hover:bg-emerald-700'
						: 'cursor-not-allowed bg-slate-100 text-slate-400'}"
				>
					{data.ready ? 'Shëno si të bërë' : 'Mungon stoku'}
				</button>
				<p class="mt-2 text-xs text-slate-500">
					{data.ready
						? 'Zbret veshjet dhe printimet DTF nga stoku.'
						: 'Shikoni faqen Stoku për çfarë duhet blerë ose printuar.'}
				</p>
			{/if}
		</section>

		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-sm font-semibold text-slate-900">Pagesa</h2>
			<button
				onclick={() => setPaymentStatus(data.order.id, data.order.paymentStatus === 'paid' ? 'unpaid' : 'paid')}
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
			>
				{data.order.paymentStatus === 'paid' ? 'Shëno si të papaguar' : 'Shëno si të paguar'}
			</button>
		</section>

		<button onclick={remove} class="w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-600">
			Fshi porosinë
		</button>
	</div>
</div>
