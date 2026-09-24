/**
 * Cents: an amount of euro, as an integer number of cents. 2450 is 24,50 €.
 *
 * All money is Cents — in the database, here, in every sum — so no amount is
 * ever 24.499999. Only the edges convert: parseEuro reads what someone typed,
 * formatEuro writes what they see.
 */
export type Cents = number;

const NBSP = ' ';

/**
 * parseEuro : String -> Cents or null
 * What someone typed as an amount of euro, or null when it isn't one.
 * Accepts a comma or a point for the decimals, and spaces between thousands.
 *   "24,50" -> 2450    "24" -> 2400    "0.12" -> 12    "1 250" -> 125000
 *   "" -> null         "abc" -> null   "-3" -> null    "1,234" -> null
 */
export function parseEuro(text: string): Cents | null {
	const t = text.replace(/[\s €]/g, '').replace(',', '.');
	if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
	const [whole, frac = ''] = t.split('.');
	return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/**
 * formatEuro : Cents -> String
 * An amount for people to read. Cents appear only when there are some, which
 * keeps tiles short; spaces are non-breaking so an amount never wraps.
 *   2500 -> "25 €"   2450 -> "24,50 €"   125000 -> "1 250 €"   -300 -> "−3 €"
 */
export function formatEuro(c: Cents): string {
	const abs = Math.abs(Math.round(c));
	const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
	const frac = abs % 100 ? `,${String(abs % 100).padStart(2, '0')}` : '';
	return `${c < 0 ? '−' : ''}${whole}${frac}${NBSP}€`;
}

/**
 * euroInput : Cents -> String
 * An amount as it goes back into a form field, so parseEuro reads it again.
 *   2500 -> "25"   2450 -> "24,50"   12 -> "0,12"
 */
export function euroInput(c: Cents): string {
	const frac = c % 100;
	return frac ? `${Math.floor(c / 100)},${String(frac).padStart(2, '0')}` : String(c / 100);
}

/**
 * divide : Cents Natural -> Cents
 * One share of an amount split n ways, rounded to the nearest cent.
 *   divide(1200, 4) -> 300   divide(1200, 7) -> 171
 */
export const divide = (c: Cents, n: number): Cents => Math.round(c / Math.max(1, n));

/** sum : [X] (X -> Number) -> Number — adds up f over a list. */
export const sum = <X>(xs: readonly X[], f: (x: X) => number): number =>
	xs.reduce((a, x) => a + f(x), 0);
