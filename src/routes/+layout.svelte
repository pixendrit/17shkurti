<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import Package from '@lucide/svelte/icons/package';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Boxes from '@lucide/svelte/icons/boxes';
	import Palette from '@lucide/svelte/icons/palette';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Lock from '@lucide/svelte/icons/lock';
	import Download from '@lucide/svelte/icons/download';
	import Upload from '@lucide/svelte/icons/upload';
	import LockScreen from '$lib/components/LockScreen.svelte';
	import { isUnlocked, lock } from '$lib/client/auth';
	import { exportDb, importDb } from '$lib/client/db';

	let { children } = $props();

	let unlocked = $state(isUnlocked());
	let busy = $state('');
	let fileInput: HTMLInputElement | null = $state(null);

	const nav = [
		{ href: `${base}/`, label: 'Dashboard', icon: LayoutDashboard },
		{ href: `${base}/orders`, label: 'Orders', icon: ShoppingBag },
		{ href: `${base}/stock`, label: 'Stock', icon: Boxes },
		{ href: `${base}/designs`, label: 'Designs', icon: Palette },
		{ href: `${base}/stats`, label: 'Stats', icon: ChartLine }
	];

	function active(href: string) {
		const path = page.url.pathname.replace(/\/$/, '');
		const target = href.replace(/\/$/, '');
		if (target === base) return path === base || path === '';
		return path.startsWith(target);
	}

	async function backup() {
		busy = 'export';
		try {
			const blob = await exportDb();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `hijeshi-${new Date().toISOString().slice(0, 10)}.db`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			busy = '';
		}
	}

	async function restore(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (!confirm('Replace everything in this browser with the backup file?')) return;
		busy = 'import';
		try {
			await importDb(file);
			await invalidateAll();
		} catch {
			alert("That file isn't a Hijeshi backup.");
		} finally {
			busy = '';
			if (fileInput) fileInput.value = '';
		}
	}
</script>

{#if !unlocked}
	<LockScreen onunlock={() => (unlocked = true)} />
{:else}
	<div class="min-h-screen lg:flex">
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
						{active(item.href) ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}"
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="space-y-1 p-3">
				<button onclick={backup} disabled={!!busy} class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
					<Download class="size-4" /> {busy === 'export' ? 'Saving…' : 'Backup'}
				</button>
				<button onclick={() => fileInput?.click()} disabled={!!busy} class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
					<Upload class="size-4" /> {busy === 'import' ? 'Restoring…' : 'Restore'}
				</button>
				<button onclick={() => { lock(); unlocked = false; }} class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
					<Lock class="size-4" /> Lock
				</button>
			</div>
		</aside>

		<header class="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
			<Package class="size-5" />
			<span class="text-sm font-semibold">Hijeshi Shqiptare</span>
			<div class="ml-auto flex gap-1">
				<button onclick={backup} aria-label="Backup" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Download class="size-4" /></button>
				<button onclick={() => { lock(); unlocked = false; }} aria-label="Lock" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Lock class="size-4" /></button>
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

	<input bind:this={fileInput} onchange={restore} type="file" accept=".db,.sqlite,application/x-sqlite3" class="hidden" />
{/if}
