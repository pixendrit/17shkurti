/**
 * A lock screen, not a security boundary.
 *
 * Everything runs in the browser and the orders never leave the device, so
 * there is no server-side secret to protect — this exists to stop someone
 * picking up an unlocked phone and reading the order book. The code is stored
 * as a SHA-256 hash so it isn't sitting in localStorage in the clear.
 */
const PIN_KEY = 'hijeshi.pin';
const UNLOCKED_KEY = 'hijeshi.unlocked';

async function hash(pin: string): Promise<string> {
	const bytes = new TextEncoder().encode(`hijeshi:${pin}`);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasPin(): boolean {
	try {
		return !!localStorage.getItem(PIN_KEY);
	} catch {
		return false;
	}
}

export async function setPin(pin: string): Promise<void> {
	localStorage.setItem(PIN_KEY, await hash(pin));
	sessionStorage.setItem(UNLOCKED_KEY, '1');
}

export async function checkPin(pin: string): Promise<boolean> {
	const stored = localStorage.getItem(PIN_KEY);
	if (!stored) return false;
	const ok = stored === (await hash(pin));
	if (ok) sessionStorage.setItem(UNLOCKED_KEY, '1');
	return ok;
}

export function isUnlocked(): boolean {
	try {
		return sessionStorage.getItem(UNLOCKED_KEY) === '1';
	} catch {
		return false;
	}
}

export function lock(): void {
	try {
		sessionStorage.removeItem(UNLOCKED_KEY);
	} catch {
		/* storage unavailable — the gate just re-prompts */
	}
}
