import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'hijeshi_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — this is a phone-in-hand tool

function secret(): string {
	const s = env.SESSION_SECRET;
	if (!s || s.length < 16) {
		throw new Error('SESSION_SECRET must be set to at least 16 characters');
	}
	return s;
}

export function expectedPin(): string {
	const pin = env.APP_PIN;
	if (!pin || !/^\d{4}$/.test(pin)) throw new Error('APP_PIN must be exactly 4 digits');
	return pin;
}

function sign(payload: string): string {
	return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Compare without leaking timing information about how much matched. */
function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	if (ab.length !== bb.length) return false;
	return timingSafeEqual(ab, bb);
}

export function checkPin(input: string): boolean {
	return safeEqual(input, expectedPin());
}

export function createSession(cookies: Cookies) {
	const issued = Date.now().toString();
	const nonce = randomBytes(8).toString('hex');
	const payload = `${issued}.${nonce}`;
	cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: env.NODE_ENV === 'production',
		maxAge: MAX_AGE
	});
}

export function destroySession(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/' });
}

export function isAuthed(cookies: Cookies): boolean {
	const raw = cookies.get(COOKIE);
	if (!raw) return false;
	const parts = raw.split('.');
	if (parts.length !== 3) return false;
	const [issued, nonce, mac] = parts;
	if (!safeEqual(mac, sign(`${issued}.${nonce}`))) return false;
	const age = (Date.now() - Number(issued)) / 1000;
	return Number.isFinite(age) && age >= 0 && age < MAX_AGE;
}

/**
 * A 4-digit PIN is only 10 000 combinations, so throttling is what actually
 * protects the account. Tracked per IP, in memory — fine for a single instance.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function lockedFor(ip: string): number {
	const rec = attempts.get(ip);
	if (!rec) return 0;
	if (rec.until > Date.now()) return Math.ceil((rec.until - Date.now()) / 1000);
	if (rec.until && rec.until <= Date.now()) attempts.delete(ip);
	return 0;
}

export function recordFailure(ip: string) {
	const rec = attempts.get(ip) ?? { count: 0, until: 0 };
	rec.count += 1;
	if (rec.count >= MAX_ATTEMPTS) {
		rec.until = Date.now() + LOCKOUT_MS;
		rec.count = 0;
	}
	attempts.set(ip, rec);
}

export function clearFailures(ip: string) {
	attempts.delete(ip);
}
