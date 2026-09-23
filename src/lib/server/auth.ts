import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { loginAttempts } from '$lib/data/schema';
import type { DB } from '$lib/data/types';

const COOKIE = 'hijeshi_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days: this lives on phones
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

const enc = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compare without leaking how much of the string matched. */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export function checkPin(input: string, expected: string): boolean {
	return safeEqual(input, expected);
}

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

export function destroySession(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/' });
}

export async function isAuthed(cookies: Cookies, secret: string): Promise<boolean> {
	const raw = cookies.get(COOKIE);
	if (!raw) return false;
	const i = raw.lastIndexOf('.');
	if (i < 0) return false;
	const payload = raw.slice(0, i);
	const mac = raw.slice(i + 1);
	if (!safeEqual(mac, await hmac(secret, payload))) return false;
	const age = (Date.now() - Number(payload.split('.')[0])) / 1000;
	return Number.isFinite(age) && age >= 0 && age < MAX_AGE;
}

/** Seconds this IP must still wait, or 0. A 4-digit PIN is only 10 000 guesses. */
export async function lockedFor(db: DB, ip: string): Promise<number> {
	const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip)).limit(1);
	const now = Math.floor(Date.now() / 1000);
	return row && row.lockedUntil > now ? row.lockedUntil - now : 0;
}

export async function recordFailure(db: DB, ip: string) {
	const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip)).limit(1);
	const count = (row?.count ?? 0) + 1;
	const lockedUntil = count >= MAX_ATTEMPTS ? Math.floor(Date.now() / 1000) + LOCKOUT_SECONDS : 0;
	const next = { count: count >= MAX_ATTEMPTS ? 0 : count, lockedUntil };
	if (row) await db.update(loginAttempts).set(next).where(eq(loginAttempts.ip, ip));
	else await db.insert(loginAttempts).values({ ip, ...next });
}

export async function clearFailures(db: DB, ip: string) {
	await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
