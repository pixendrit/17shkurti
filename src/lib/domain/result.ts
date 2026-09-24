/**
 * Result<T>: the outcome of a decision that can be refused.
 *   { ok: true, value }   it can be done, and here is what it produces
 *   { ok: false, error }  it can't, and here is why, in words for the shop
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });
