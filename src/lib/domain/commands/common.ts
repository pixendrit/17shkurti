import { IMAGE_MIMES, type Change, type Context, type Image, type Upload } from '../model';
import { fail, ok, type Result } from '../result';

/** Command<I>: a decision about the world, given an input: the changes to write, or why not. */
export type Command<I> = (w: import('../model').World, input: I, ctx: Context) => Result<Change[]>;

/** A picture's data is at most ~950 KB as base64 — pictures are shrunk in the browser first. */
export const MAX_IMAGE = 950 * 1024;

/**
 * storeImage : Upload Context -> Result<Image>
 * An uploaded picture as a record to store, if it's one the app can show.
 */
export function storeImage(u: Upload, ctx: Context): Result<Image> {
	if (!(IMAGE_MIMES as readonly string[]).includes(u.mime)) return fail('Fotot duhet të jenë WebP, JPEG ose PNG.');
	if (!u.data || u.data.length > MAX_IMAGE) return fail('Fotoja është shumë e madhe.');
	return ok({ id: ctx.newId(), mime: u.mime, data: u.data, createdAt: ctx.now });
}

/** isCount : Any -> Boolean — a whole number of pieces, at least 1. */
export const isCount = (n: number) => Number.isInteger(n) && n >= 1 && n <= 100000;

/** isAmount : Any -> Boolean — a whole number of cents, not negative. */
export const isAmount = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100_000_000;
