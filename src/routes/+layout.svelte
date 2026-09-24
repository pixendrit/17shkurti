<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import Package from '@lucide/svelte/icons/package';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Boxes from '@lucide/svelte/icons/boxes';
	import Palette from '@lucide/svelte/icons/palette';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Lock from '@lucide/svelte/icons/lock';
	import Download from '@lucide/svelte/icons/download';

	let { children } = $props();

	const nav = [
		{ href: `${base}/`, label: 'Paneli', icon: LayoutDashboard },
		{ href: `${base}/orders`, label: 'Porositë', icon: ShoppingBag },
		{ href: `${base}/stock`, label: 'Stoku', icon: Boxes },
		{ href: `${base}/designs`, label: 'Dizajnet', icon: Palette },
		{ href: `${base}/stats`, label: 'Statistika', icon: ChartLine }
	];

	function active(href: string) {
		const path = page.url.pathname.replace(/\/$/, '');
		const target = href.replace(/\/$/, '');
		if (target === base) return path === base || path === '';
		return path.startsWith(target);
	}

</script>

{#if page.url.pathname.startsWith('/login')}
	{@render children()}
{:else}
	<div class="min-h-screen lg:flex">
		<aside class="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
			<div class="flex items-center gap-2 px-5 py-5">
				<Package class="size-5 text-slate-900" />
				<div class="leading-tight">
					<div class="text-sm font-semibold text-slate-900">Hijeshi Shqiptare</div>
					<div class="text-xs text-slate-500">Menaxhimi i porosive</div>
				</div>
			</div>
			<nav class="flex-1 space-y-1 px-3">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
						{active(item.href) ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}"
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="space-y-1 p-3">
				<a href="/api/backup" download class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
					<Download class="size-4" /> Kopje rezervë
				</a>
				<form method="POST" action="/logout">
					<button class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
						<Lock class="size-4" /> Kyç
					</button>
				</form>
			</div>
		</aside>

		<header class="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
			<Package class="size-5" />
			<span class="text-sm font-semibold">Hijeshi Shqiptare</span>
			<div class="ml-auto flex gap-1">
				<a href="/api/backup" download aria-label="Kopje rezervë" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Download class="size-4" /></a>
				<form method="POST" action="/logout">
					<button aria-label="Kyç" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Lock class="size-4" /></button>
				</form>
			</div>
		</header>

		<main class="flex-1 pb-24 lg:pb-0">
			<div class="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
				{@render children()}
			</div>
		</main>

		<nav class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden">
			{#each nav as item (item.href)}
				<a href={item.href} class="flex flex-col items-center gap-1 py-2 text-[11px] font-medium {active(item.href) ? 'text-slate-900' : 'text-slate-500'}">
					<item.icon class="size-5" />
					{item.label}
				</a>
			{/each}
		</nav>
	</div>

{/if}
