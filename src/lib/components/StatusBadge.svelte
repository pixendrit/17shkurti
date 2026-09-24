<script lang="ts">
	import { STATUS_STYLES, statusLabel } from '$lib/constants';
	let { status, delivery = 'post' }: { status: string; delivery?: string } = $props();
</script>

<span
	class="inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset {STATUS_STYLES[
		status
	] ?? 'bg-slate-100 text-slate-700 ring-slate-500/20'}"
>
	{statusLabel(status, delivery)}
</span>
