<script lang="ts">
	import { monthLabel as fullMonth } from '$lib/ui';
	/**
	 * Single-series trend over time. One series means no legend box — the card
	 * title already says what is plotted. Hover gives a crosshair + tooltip.
	 */
	let {
		points,
		format = (n: number) => String(n),
		label = 'Vlera'
	}: {
		points: { x: string; y: number }[];
		format?: (n: number) => string;
		label?: string;
	} = $props();

	const W = 720;
	const H = 220;
	const PAD = { top: 16, right: 16, bottom: 28, left: 8 };

	const max = $derived(Math.max(1, ...points.map((p) => p.y)));
	const innerW = W - PAD.left - PAD.right;
	const innerH = H - PAD.top - PAD.bottom;

	const xs = $derived(
		points.map((_, i) =>
			points.length === 1 ? PAD.left + innerW / 2 : PAD.left + (i / (points.length - 1)) * innerW
		)
	);
	const ys = $derived(points.map((p) => PAD.top + innerH - (p.y / max) * innerH));

	const linePath = $derived(xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' '));
	const areaPath = $derived(
		points.length === 0
			? ''
			: `${linePath} L${xs[xs.length - 1]},${PAD.top + innerH} L${xs[0]},${PAD.top + innerH} Z`
	);

	let hover = $state<number | null>(null);
	let svgEl = $state<SVGSVGElement | null>(null);

	function onMove(e: PointerEvent) {
		if (points.length === 0) return;
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		// Map pointer position into the SVG's own coordinate space.
		const x = ((e.clientX - rect.left) / rect.width) * W;
		let best = 0;
		for (let i = 1; i < xs.length; i++) {
			if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
		}
		hover = best;
	}

	/** "2026-09" -> "sht 26": short enough for the axis. */
	const monthLabel = (key: string) => fullMonth(key).replace(/ \d\d(\d\d)$/, ' $1');
</script>

{#if points.length === 0}
	<p class="py-10 text-center text-sm text-slate-500">Ende s'ka të dhëna për këtë periudhë.</p>
{:else}
	<div class="relative">
		<svg
			bind:this={svgEl}
			viewBox="0 0 {W} {H}"
			class="w-full touch-none"
			role="img"
			aria-label="{label} sipas kohës"
			onpointermove={onMove}
			onpointerleave={() => (hover = null)}
		>
			<!-- recessive hairline gridlines -->
			{#each [0, 0.5, 1] as t (t)}
				<line
					x1={PAD.left}
					x2={W - PAD.right}
					y1={PAD.top + innerH * t}
					y2={PAD.top + innerH * t}
					stroke="#e2e8f0"
					stroke-width="1"
				/>
			{/each}

			<path d={areaPath} fill="var(--series-1)" opacity="0.1" />
			<path
				d={linePath}
				fill="none"
				stroke="var(--series-1)"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>

			<!-- endpoint marker only: labelling every point is noise -->
			{#if xs.length > 0}
				<circle
					cx={xs[xs.length - 1]}
					cy={ys[ys.length - 1]}
					r="4.5"
					fill="var(--series-1)"
					stroke="#ffffff"
					stroke-width="2"
				/>
			{/if}

			{#if hover !== null}
				<line
					x1={xs[hover]}
					x2={xs[hover]}
					y1={PAD.top}
					y2={PAD.top + innerH}
					stroke="#94a3b8"
					stroke-width="1"
				/>
				<circle cx={xs[hover]} cy={ys[hover]} r="4.5" fill="var(--series-1)" stroke="#ffffff" stroke-width="2" />
			{/if}

			{#each points as p, i (p.x)}
				{#if i === 0 || i === points.length - 1 || points.length <= 6}
					<text x={xs[i]} y={H - 8} text-anchor={points.length > 1 && i === 0 ? 'start' : points.length > 1 && i === points.length - 1 ? 'end' : 'middle'} font-size="11" fill="#64748b">
						{monthLabel(p.x)}
					</text>
				{/if}
			{/each}
		</svg>

		{#if hover !== null}
			<div
				class="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg"
				style="left: {(xs[hover] / W) * 100}%; top: {(ys[hover] / H) * 100}%;"
			>
				<div class="font-medium">{format(points[hover].y)}</div>
				<div class="text-slate-300">{monthLabel(points[hover].x)}</div>
			</div>
		{/if}
	</div>
{/if}
