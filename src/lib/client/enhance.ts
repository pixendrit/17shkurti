import type { SubmitFunction } from '@sveltejs/kit';

/**
 * busy : options -> SubmitFunction
 * For `use:enhance`: disables the button while the form is saving, asks
 * first when there's a question, and keeps what was typed when `reset` is
 * false (edit forms), runs `after` once the page has the new data, and
 * `failed` when the save was refused or broke.
 */
export function busy({
	reset = true,
	confirm: question,
	after,
	failed
}: { reset?: boolean; confirm?: string; after?: () => void; failed?: () => void } = {}): SubmitFunction {
	return ({ submitter, cancel }) => {
		if (question && !window.confirm(question)) {
			cancel();
			return;
		}
		submitter?.setAttribute('disabled', '');
		submitter?.setAttribute('aria-busy', 'true');
		return async ({ result, update }) => {
			await update({ reset });
			submitter?.removeAttribute('disabled');
			submitter?.removeAttribute('aria-busy');
			if (result.type === 'failure' || result.type === 'error') failed?.();
			after?.();
		};
	};
}
