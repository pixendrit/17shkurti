<script lang="ts">
	import { page } from '$app/state';
	/** Shows why the last form on the page was refused. */
</script>

{#if page.form?.error}
	<p role="alert" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{page.form.error}</p>
{/if}
