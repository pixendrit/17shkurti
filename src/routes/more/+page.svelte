<script lang="ts">
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Users from '@lucide/svelte/icons/users';
	import Palette from '@lucide/svelte/icons/palette';
	import Settings from '@lucide/svelte/icons/settings';
	import Download from '@lucide/svelte/icons/download';
	import Lock from '@lucide/svelte/icons/lock';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	const links = [
		{ href: '/stats', label: 'Statistika', hint: 'Fitimi, burimet, shtetet', icon: ChartLine },
		{ href: '/purchases', label: 'Blerjet', hint: 'Bluza, fletë DTF, shpenzime', icon: Receipt },
		{ href: '/customers', label: 'Klientët', hint: 'Kush blen, sa shpesh', icon: Users },
		{ href: '/designs', label: 'Dizajnet', hint: 'Fotot para dhe pas', icon: Palette },
		{ href: '/settings', label: 'Cilësimet', hint: 'Kostot dhe çmimet', icon: Settings }
	];
</script>

<svelte:head><title>Më shumë — Hijeshi</title></svelte:head>

<h1 class="mb-5 text-xl font-semibold text-slate-900">Më shumë</h1>

<div class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
	{#each links as l (l.href)}
		<a href={l.href} class="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
			<l.icon class="size-5 text-slate-600" />
			<div class="flex-1">
				<p class="text-sm font-medium text-slate-900">{l.label}</p>
				<p class="text-xs text-slate-500">{l.hint}</p>
			</div>
			<ChevronRight class="size-4 text-slate-400" />
		</a>
	{/each}
</div>

<div class="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
	<a href="/api/backup" download class="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
		<Download class="size-5 text-slate-600" /><span class="flex-1 text-sm font-medium text-slate-900">Kopje rezervë</span>
	</a>
	<form method="POST" action="/logout">
		<button class="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
			<Lock class="size-5 text-slate-600" /><span class="flex-1 text-sm font-medium text-slate-900">Kyç</span>
		</button>
	</form>
</div>
