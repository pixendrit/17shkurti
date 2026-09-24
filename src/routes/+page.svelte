<script lang="ts">
	import StatTile from '$lib/components/StatTile.svelte';
	import OrderList from '$lib/components/OrderList.svelte';
	import { money, plural } from '$lib/ui';
	import Plus from '@lucide/svelte/icons/plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Printer from '@lucide/svelte/icons/printer';
	import Brush from '@lucide/svelte/icons/brush';
	import Truck from '@lucide/svelte/icons/truck';
	import Wallet from '@lucide/svelte/icons/wallet';

	let { data } = $props();
</script>

<svelte:head><title>Paneli — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between gap-3">
	<div>
		<h1 class="text-xl font-semibold text-slate-900">Sot</h1>
		<p class="text-sm text-slate-500">
			{plural(data.openCount, 'porosi e hapur', 'porosi të hapura')}{#if data.newCount > 0}, {plural(data.newCount, 'e re', 'të reja')}{/if}
		</p>
	</div>
	<a href="/orders/new" class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
		<Plus class="size-4" /> Porosi e re
	</a>
</div>

<div class="mb-4 grid grid-cols-3 gap-3">
	<StatTile label="Të ardhurat (30 ditë)" value={money(data.revenue30)} />
	<StatTile label="Fitimi neto (30 ditë)" value={money(data.net30)} tone="good" />
	<StatTile label="Për t'u arkëtuar" value={money(data.outstanding)} tone={data.outstanding > 0 ? 'warn' : 'neutral'} />
</div>

<!-- Things that need doing, each linking to where they get done. -->
<div class="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
	{#if data.waitingCourier}
		<a href="/shipments" class="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-3 hover:border-purple-300">
			<PackageCheck class="size-5 shrink-0 text-purple-700" />
			<p class="text-sm font-semibold text-purple-900">{plural(data.waitingCourier, 'pako pret', 'pako presin')} postierin</p>
		</a>
	{/if}
	{#if data.withCourier}
		<a href="/shipments" class="flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 hover:border-cyan-300">
			<Truck class="size-5 shrink-0 text-cyan-700" />
			<p class="text-sm font-semibold text-cyan-900">{plural(data.withCourier, 'pako', 'pako')} te postieri</p>
		</a>
	{/if}
	{#if data.deliveredUnpaid > 0}
		<a href="/shipments" class="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 hover:border-emerald-300">
			<Wallet class="size-5 shrink-0 text-emerald-700" />
			<p class="text-sm font-semibold text-emerald-900">{money(data.deliveredUnpaid)} të dorëzuara, pa u paguar</p>
		</a>
	{/if}
	{#if data.toBuy > 0}
		<a href="/stock" class="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 hover:border-amber-300">
			<ShoppingCart class="size-5 shrink-0 text-amber-700" />
			<p class="text-sm font-semibold text-amber-900">Bli {plural(data.toBuy, 'bluzë', 'bluza')} pa print</p>
		</a>
	{/if}
	{#if data.toPrint.length > 0}
		<a href="/stock" class="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 hover:border-orange-300">
			<Printer class="size-5 shrink-0 text-orange-700" />
			<div class="min-w-0">
				<p class="text-sm font-semibold text-orange-900">Printo DTF për {plural(data.toPrint.length, 'dizajn', 'dizajne')}</p>
				<p class="truncate text-xs text-orange-800">{data.toPrint.map((t) => `${t.short} × ${t.label}`).join(', ')}</p>
			</div>
		</a>
	{/if}
	{#if data.customPending > 0}
		<a href="/stock" class="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 hover:border-violet-300">
			<Brush class="size-5 shrink-0 text-violet-700" />
			<p class="text-sm font-semibold text-violet-900">{plural(data.customPending, 'print i personalizuar', 'printime të personalizuara')} për të printuar</p>
		</a>
	{/if}
</div>

<div class="grid gap-4 *:min-w-0 lg:grid-cols-3">
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<CircleCheck class="size-4 text-emerald-600" /><h2 class="text-sm font-semibold text-slate-900">Mund të bëhen tani</h2>
			<span class="ml-auto text-xs text-slate-400">{data.canMake.length}</span>
		</header>
		<OrderList rows={data.canMake} limit={8} empty="Asgjë në pritje për printim." />
	</section>
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<TriangleAlert class="size-4 text-amber-600" /><h2 class="text-sm font-semibold text-slate-900">Në pritje të stokut</h2>
			<span class="ml-auto text-xs text-slate-400">{data.blocked.length}</span>
		</header>
		<OrderList rows={data.blocked} limit={8} detail="missing" empty="Asgjë e bllokuar." />
	</section>
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<PackageCheck class="size-4 text-purple-600" /><h2 class="text-sm font-semibold text-slate-900">Gati, të paketuara</h2>
			<span class="ml-auto text-xs text-slate-400">{data.ready.length}</span>
		</header>
		<OrderList rows={data.ready} limit={8} detail="contact" empty="Ende asgjë e paketuar." />
	</section>
</div>
