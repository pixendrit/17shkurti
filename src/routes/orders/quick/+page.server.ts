import { createDraft } from '$lib/domain/commands/orders';
import { parseDraft } from '$lib/domain/forms';
import { ok } from '$lib/domain/result';
import { act } from '$lib/server/shop';

export const actions = {
	default: (e) => act(e, createDraft, (f) => ok(parseDraft(f)))
};
