<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import Package from '@lucide/svelte/icons/package';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Boxes from '@lucide/svelte/icons/boxes';
	import Palette from '@lucide/svelte/icons/palette';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import LogOut from '@lucide/svelte/icons/log-out';

	let { data, children } = $props();

	const nav = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/orders', label: 'Orders', icon: ShoppingBag },
		{ href: '/stock', label: 'Stock', icon: Boxes },
		{ href: '/designs', label: 'Designs', icon: Palette },
		{ href: '/stats', label: 'Stats', icon: ChartLine }
	];

	function active(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

{#if !data.authed}
	{@render children()}
{:else}
	<div class="min-h-screen lg:flex">
		<!-- Sidebar on desktop -->
		<aside class="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
			<div class="flex items-center gap-2 px-5 py-5">
				<Package class="size-5 text-slate-900" />
				<div class="leading-tight">
					<div class="text-sm font-semibold text-slate-900">Hijeshi Shqiptare</div>
					<div class="text-xs text-slate-500">Order desk</div>
				</div>
			</div>
			<nav class="flex-1 space-y-1 px-3">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
						{active(item.href)
							? 'bg-slate-900 text-white'
							: 'text-slate-700 hover:bg-slate-100'}"
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>
			<form method="POST" action="/logout" class="p-3">
				<button
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
				>
					<LogOut class="size-4" /> Lock
				</button>
			</form>
		</aside>

		<!-- Top bar on mobile -->
		<header
			class="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:hidden"
		>
			<Package class="size-5" />
			<span class="text-sm font-semibold">Hijeshi Shqiptare</span>
		</header>

		<main class="flex-1 pb-24 lg:pb-0">
			<div class="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
				{@render children()}
			</div>
		</main>

		<!-- Bottom tab bar on mobile: this gets used one-handed while packing orders -->
		<nav
			class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden"
		>
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class="flex flex-col items-center gap-1 py-2 text-[11px] font-medium
					{active(item.href) ? 'text-slate-900' : 'text-slate-500'}"
				>
					<item.icon class="size-5" />
					{item.label}
				</a>
			{/each}
		</nav>
	</div>
{/if}
