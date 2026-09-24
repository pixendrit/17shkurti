/**
 * The PIN lock: a signed session cookie, and throttling of wrong PINs.
 */
import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'hijeshi_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days: this lives on phones
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

const enc = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares without leaking how much of the string matched. */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export const checkPin = (input: string, expected: string) => safeEqual(input, expected);

export async function createSession(cookies: Cookies, secret: string, secure: boolean) {
	const payload = `${Date.now()}.${crypto.randomUUID()}`;
	cookies.set(COOKIE, `${payload}.${await hmac(secret, payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: MAX_AGE
	});
}

export const destroySession = (cookies: Cookies) => cookies.delete(COOKIE, { path: '/' });

export async function isAuthed(cookies: Cookies, secret: string): Promise<boolean> {
	const raw = cookies.get(COOKIE);
	const i = raw?.lastIndexOf('.') ?? -1;
	if (!raw || i < 0) return false;
	const payload = raw.slice(0, i);
	if (!safeEqual(raw.slice(i + 1), await hmac(secret, payload))) return false;
	const age = (Date.now() - Number(payload.split('.')[0])) / 1000;
	return Number.isFinite(age) && age >= 0 && age < MAX_AGE;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Seconds this IP must still wait, or 0. A 4-digit PIN is only 10 000 guesses. */
export async function lockedFor(db: D1Database, ip: string): Promise<number> {
	const row = await db.prepare('SELECT locked_until FROM login_attempts WHERE ip = ?').bind(ip).first<{ locked_until: number }>();
	const now = nowSeconds();
	return row && row.locked_until > now ? row.locked_until - now : 0;
}

/** Counts a wrong PIN; the fifth locks the IP out for a while. */
export async function recordFailure(db: D1Database, ip: string) {
	const lockUntil = nowSeconds() + LOCKOUT_SECONDS;
	await db
		.prepare(
			`INSERT INTO login_attempts (ip, count, locked_until) VALUES (?, 1, 0)
			 ON CONFLICT (ip) DO UPDATE SET
			   locked_until = CASE WHEN count + 1 >= ? THEN ? ELSE 0 END,
			   count = CASE WHEN count + 1 >= ? THEN 0 ELSE count + 1 END`
		)
		.bind(ip, MAX_ATTEMPTS, lockUntil, MAX_ATTEMPTS)
		.run();
}

export const clearFailures = (db: D1Database, ip: string) =>
	db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
