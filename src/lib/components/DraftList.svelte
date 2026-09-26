<script lang="ts">
	import Thumb from './Thumb.svelte';
	import { formatDateTime } from '$lib/ui';
	import Zap from '@lucide/svelte/icons/zap';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	/** Quick orders waiting to be completed: each opens the order form, filled in. */
	let { drafts }: { drafts: { id: string; cover: string | null; count: number; name: string; phone: string; note: string; createdAt: number }[] } = $props();
</script>

{#if drafts.length}
	<section class="mb-4 rounded-xl border border-amber-300 bg-amber-50 shadow-sm">
		<header class="flex items-center gap-2 border-b border-amber-200 px-4 py-3">
			<Zap class="size-4 text-amber-700" />
			<h2 class="text-sm font-semibold text-amber-950">Për t'u plotësuar</h2>
			<span class="ml-auto text-xs text-amber-800">{drafts.length}</span>
		</header>
		<ul class="divide-y divide-amber-200">
			{#each drafts as d (d.id)}
				<li>
					<a href="/orders/new?draft={d.id}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-100/60">
						<Thumb id={d.cover} size="size-12" alt="Screenshot" />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-slate-900">{d.name || d.phone || 'Pa emër'}</p>
							<p class="truncate text-xs text-slate-600">
								{[formatDateTime(d.createdAt), d.count ? `${d.count} screenshot` : '', d.note].filter(Boolean).join(' · ')}
							</p>
						</div>
						<span class="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-amber-800">Plotëso <ChevronRight class="size-4" /></span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
