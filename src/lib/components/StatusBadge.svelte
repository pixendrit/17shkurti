<script lang="ts">
	import { STATUS_LABELS, STATUS_STYLES } from '$lib/constants';
	let { status }: { status: string } = $props();
</script>

<span
	class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset {STATUS_STYLES[
		status
	] ?? 'bg-slate-100 text-slate-700 ring-slate-500/20'}"
>
	{STATUS_LABELS[status] ?? status}
</span>
