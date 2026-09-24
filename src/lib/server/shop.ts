/**
 * The imperative shell around the domain: every request that changes
 * something is load → decide → commit.
 */
import { fail as httpFail, type RequestEvent } from '@sveltejs/kit';
import type { Command } from '$lib/domain/commands/common';
import type { Form } from '$lib/domain/forms';
import type { Change, Context, Upload, World } from '$lib/domain/model';
import { IMAGE_MIMES } from '$lib/domain/model';
import { fail, ok, type Result } from '$lib/domain/result';
import { commit, loadWorld } from './repo';

export const context = (): Context => ({ now: Math.floor(Date.now() / 1000), newId: () => crypto.randomUUID() });

/**
 * run : D1 Command Input -> Result<[Change]>
 * Loads the world, lets the command decide, and commits what it decided.
 * If someone else took the same order number a moment earlier, decides
 * once more on the fresh world.
 */
export async function run<I>(db: D1Database, command: Command<I>, input: I, ctx = context()): Promise<Result<Change[]>> {
	for (let attempt = 0; ; attempt++) {
		const r = command(await loadWorld(db), input, ctx);
		if (!r.ok) return r;
		try {
			await commit(db, r.value);
			return r;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (attempt === 0 && /UNIQUE constraint failed: orders\.code/.test(msg)) continue;
			if (/UNIQUE constraint failed: designs\.name/.test(msg)) return fail('Ekziston tashmë një dizajn me këtë emër.');
			console.error('commit failed', msg);
			return fail('Nuk u ruajt: të dhënat nuk u pranuan nga databaza.');
		}
	}
}

/** base64 : ArrayBuffer -> String */
function base64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(s);
}

/**
 * readForm : Request -> Form
 * The submitted form, with every picture read in, ready for the parsers.
 */
export async function readForm(request: Request): Promise<Form> {
	const data = await request.formData();
	const uploads = new Map<string, Upload>();
	for (const [name, v] of data.entries())
		if (typeof v !== 'string' && v.size > 0)
			uploads.set(name, {
				mime: ((IMAGE_MIMES as readonly string[]).includes(v.type) ? v.type : 'invalid') as Upload['mime'],
				data: base64(await v.arrayBuffer())
			});
	return {
		text: (n) => {
			const v = data.get(n);
			return typeof v === 'string' ? v : '';
		},
		list: (n) => data.getAll(n).filter((v): v is string => typeof v === 'string'),
		upload: (n) => uploads.get(n) ?? null
	};
}

/**
 * act : RequestEvent Command (Form Context -> Result<Input>) -> ActionResult
 * A form action: read the form, parse it, run the command. A refusal comes
 * back to the page as `form.error`; success returns the changes made.
 */
export async function act<I>(
	event: RequestEvent,
	command: Command<I>,
	parse: (f: Form, ctx: Context) => Result<I>
) {
	const ctx = context();
	const input = parse(await readForm(event.request), ctx);
	if (!input.ok) return httpFail(400, { error: input.error });
	const r = await run(event.locals.db, command, input.value, ctx);
	if (!r.ok) return httpFail(400, { error: r.error });
	return { changes: r.value.length };
}

/** withId : Form String -> Result<String> — the record id a form acts on. */
export const need = (f: Form, name: string): Result<string> => (f.text(name) ? ok(f.text(name)) : fail('Mungon zgjedhja.'));

/** load : RequestEvent -> World — the world for a page, in one round trip. */
export const load = (event: Pick<RequestEvent, 'locals'>): Promise<World> => loadWorld(event.locals.db);
