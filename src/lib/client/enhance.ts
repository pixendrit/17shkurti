import type { SubmitFunction } from '@sveltejs/kit';

/**
 * busy : options -> SubmitFunction
 * For `use:enhance`: disables the button while the form is saving, asks
 * first when there's a question, and keeps what was typed when `reset` is
 * false (edit forms), and runs `after` once the page has the new data.
 */
export function busy({
	reset = true,
	confirm: question,
	after
}: { reset?: boolean; confirm?: string; after?: () => void } = {}): SubmitFunction {
	return ({ submitter, cancel }) => {
		if (question && !window.confirm(question)) {
			cancel();
			return;
		}
		submitter?.setAttribute('disabled', '');
		submitter?.setAttribute('aria-busy', 'true');
		return async ({ update }) => {
			await update({ reset });
			submitter?.removeAttribute('disabled');
			submitter?.removeAttribute('aria-busy');
			after?.();
		};
	};
}
