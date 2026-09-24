<script lang="ts">
	import { STATUS_STYLES } from '$lib/ui';
	import type { Status } from '$lib/domain/model';
	let { status, label }: { status: Status; label: string } = $props();
</script>

<span class="inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset {STATUS_STYLES[status]}">
	{label}
</span>
