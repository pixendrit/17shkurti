<script lang="ts">
	/** One priority: a goal with its progress, or a daily one with a box per day. */
	import { enhance } from '$app/forms';
	import { busy } from '$lib/client/enhance';
	import { dayLabel, weekdayLabel } from '$lib/domain/time';
	import type { Priority } from '$lib/domain/model';
	import { field, label, primary, secondary } from '$lib/ui';
	import Check from '@lucide/svelte/icons/check';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	type DayState = { day: string; state: 'done' | 'missed' | 'today' | 'future' };
	let {
		p,
		compact = false,
		canCarry = false
	}: { p: Priority & { status: 'done' | 'late' | 'ongoing'; score: number; total: number; days: DayState[] }; compact?: boolean; canCarry?: boolean } = $props();

	let editing = $state(false);
	// Follows the saved progress; dragging overrides it until the next save (or back, if that fails).
	let slider = $derived(p.kind === 'goal' ? p.progress : 0);
	const revert = () => (slider = p.kind === 'goal' ? p.progress : 0);

	const tone = { done: 'border-emerald-300 bg-emerald-50/60', late: 'border-rose-300 bg-rose-50/50', ongoing: 'border-slate-200 bg-white' };
	const box = {
		done: 'border-emerald-600 bg-emerald-600 text-white',
		missed: 'border-rose-300 bg-rose-50 text-rose-700',
		today: 'border-slate-900 bg-white text-slate-900 ring-2 ring-slate-900/10',
		future: 'border-slate-200 bg-white text-slate-500'
	};
</script>

<div class="rounded-xl border p-4 shadow-sm {tone[p.status]}">
	{#if editing}
		<form method="POST" action="/priorities?/edit" use:enhance={busy({ reset: false, after: () => (editing = false) })} class="space-y-2">
			<input type="hidden" name="id" value={p.id} />
			<input name="title" value={p.title} required class={field} aria-label="Prioriteti" />
			<input name="note" value={p.note} placeholder="Shënim" class={field} aria-label="Shënim" />
			{#if p.kind === 'goal'}<label class="block"><span class={label}>Afati</span><input type="date" name="due" min={p.week} value={p.due ?? ''} class={field} /></label>{/if}
			<div class="flex flex-wrap gap-2">
				<button class={primary}>Ruaj</button>
				<button type="button" onclick={() => (editing = false)} class={secondary}>Anulo</button>
			</div>
		</form>
		<form method="POST" action="/priorities?/remove" use:enhance={busy({ confirm: `Ta fshij „${p.title}”?` })} class="mt-2">
			<input type="hidden" name="id" value={p.id} />
			<button class="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"><Trash2 class="size-3.5" /> Fshije</button>
		</form>
	{:else}
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="font-semibold text-slate-900">
					{#if p.status === 'done'}<Check class="mr-0.5 inline size-4 text-emerald-600" />{/if}{p.title}
				</p>
				{#if p.note}<p class="text-sm text-slate-600">{p.note}</p>{/if}
				<p class="mt-0.5 text-xs text-slate-500">
					{#if p.kind === 'goal'}
						Qëllim{#if p.due} · afati <span class={p.status === 'late' ? 'font-semibold text-rose-700' : ''}>{weekdayLabel(p.due).toLowerCase()} {dayLabel(p.due)}</span>{/if}
					{:else}
						Çdo ditë · <span class="tabular font-medium">{p.score}/{p.total}</span> ditë
					{/if}
				</p>
			</div>
			{#if !compact}
				<div class="flex shrink-0 gap-1">
					{#if canCarry && p.status !== 'done'}
						<form method="POST" action="/priorities?/carry" use:enhance={busy()}>
							<input type="hidden" name="id" value={p.id} />
							<button title="Kaloje në javën tjetër" aria-label="Kaloje në javën tjetër" class="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50"><ArrowRight class="size-3.5" /></button>
						</form>
					{/if}
					<button onclick={() => (editing = true)} aria-label="Ndrysho" class="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50"><Pencil class="size-3.5" /></button>
				</div>
			{/if}
		</div>

		{#if p.kind === 'goal'}
			<form method="POST" action="/priorities?/progress" use:enhance={busy({ reset: false, failed: revert })} class="mt-3 flex items-center gap-3">
				<input type="hidden" name="id" value={p.id} />
				<input type="range" name="progress" min="0" max="100" step="1" bind:value={slider} onchange={(e) => e.currentTarget.form?.requestSubmit()} class="flex-1 accent-emerald-600" aria-label="Përparimi" />
				<span class="tabular w-11 text-right text-sm font-semibold {slider >= 100 ? 'text-emerald-700' : 'text-slate-900'}">{slider}%</span>
				{#if p.progress < 100}
					<button name="done" value="1" class="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Check class="size-3.5" /> U krye</button>
				{/if}
			</form>
		{:else}
			<div class="mt-3 grid grid-cols-7 gap-1.5">
				{#each p.days as d (d.day)}
					<form method="POST" action="/priorities?/day" use:enhance={busy()}>
						<input type="hidden" name="id" value={p.id} />
						<input type="hidden" name="day" value={d.day} />
						<button
							disabled={d.state === 'future'}
							aria-label="{weekdayLabel(d.day)} {dayLabel(d.day)}: {d.state === 'done' ? 'u bë' : 'jo ende'}"
							aria-pressed={d.state === 'done'}
							class="flex w-full flex-col items-center rounded-lg border px-0.5 py-1.5 text-[11px] font-medium {box[d.state]} disabled:cursor-default"
						>
							<span>{weekdayLabel(d.day).replace('E ', '').slice(0, 3)}</span>
							<span class="tabular text-[10px] opacity-80">{d.day.slice(8)}</span>
							{#if d.state === 'done'}<Check class="mt-0.5 size-3.5" />{:else}<span class="mt-0.5 block size-3.5"></span>{/if}
						</button>
					</form>
				{/each}
			</div>
		{/if}
	{/if}
</div>
