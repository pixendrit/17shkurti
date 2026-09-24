/**
 * Build an import payload for POST /api/import:
 *   - optional courier export rows (real parcels) → real orders
 *   - demo orders and expenses → marked isDemo, removable from Settings
 *
 *   node scripts/demo-data.mjs --designs '{"Black":[1,2],"White":[3,4]}' \
 *     [--courier rows.json] [--mockups dir] [--total 100] --out payload.json
 *
 * The courier file holds real customers, so it is read from wherever you keep
 * it and never belongs in this repository. Output is deterministic (seeded).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
	process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
// Design ids by shirt colour: the shop keeps a black and a white version of
// each design, since the print differs between them.
const designsByColor = JSON.parse(args.designs ?? '{}');
const designIds = Object.values(designsByColor).flat();
const TOTAL = Number(args.total ?? 100);

// Seeded PRNG, so the same command always produces the same data.
let seed = 20260924;
const rnd = () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rnd() * list.length)];
const weighted = (pairs) => {
	let r = rnd() * pairs.reduce((a, [, w]) => a + w, 0);
	for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
	return pairs[0][0];
};
const DAY = 86400;
const ts = (y, m, d, h = 12) => Math.floor(Date.UTC(y, m - 1, d, h) / 1000);
const size = () => weighted([['S', 10], ['M', 30], ['L', 30], ['XL', 20], ['XXL', 10]]);
const color = () => weighted([['Black', 65], ['White', 35]]);
const designFor = (c) => pick(designsByColor[c] ?? designIds);
const item = (qty = 1, price = 25, extra = {}) => {
	const c = extra.color ?? color();
	return { productType: 'Oversized 200g', size: size(), designId: designFor(c), quantity: qty, unitPrice: price, ...extra, color: c };
};

const orders = [];

// ---- Real parcels from the courier export --------------------------------
const parseDate = (s) => {
	const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? '').trim());
	return m ? ts(+m[3], +m[2], +m[1]) : null;
};
const countryOf = (phone, shipping) =>
	phone.startsWith('+383') ? 'XK' : phone.startsWith('+355') ? 'AL' : phone.startsWith('+389') ? 'MK' : shipping <= 2.5 ? 'XK' : 'OTHER';

if (args.courier) {
	const rows = JSON.parse(readFileSync(args.courier, 'utf8'));
	for (const r of rows) {
		const created = parseDate(r.created);
		const delivered = parseDate(r.delivered);
		const depot = parseDate(r.depot);
		const gift = !(r.price > 0);
		// The export has one amount per parcel; at the usual 25 € that's the shirt count.
		const qty = gift ? 1 : Math.max(1, Math.round(r.price / 25));
		const unit = gift ? 0 : Math.round((r.price / qty) * 100) / 100;
		const settled = String(r.settledClient).toLowerCase() === 'true';
		orders.push({
			input: {
				kind: gift ? 'gift' : 'sale',
				customerName: r.name,
				phone: r.phone,
				address: r.address,
				city: r.city,
				country: countryOf(r.phone, r.shipping),
				channel: 'other',
				deliveryMethod: 'post',
				paymentStatus: settled ? 'paid' : 'unpaid',
				paymentMethod: 'cash_on_delivery',
				shippingFee: 0,
				discount: 0,
				shippingCost: r.shipping,
				trackingRef: r.ref,
				notes:
					'Importuar nga eksporti i postës. Burimi, dizajni, ngjyra dhe masa nuk ishin në eksport — ' +
					'janë vendosur si shembull, kontrollojini.' +
					(qty > 1 ? ` Sasia ${qty} u nxor nga shuma ${r.price} €.` : '') +
					(gift ? ' Shuma 0 € — u trajtua si dhuratë.' : ''),
				items: [item(qty, unit)]
			},
			extra: {
				status: String(r.status).toLowerCase().startsWith('dorez') ? 'delivered' : 'shipped',
				createdAt: created,
				shippedAt: depot ?? created,
				deliveredAt: delivered,
				paidAt: settled ? delivered : null,
				alreadyMade: true,
				isDemo: false
			}
		});
	}
}

// ---- Demo orders ------------------------------------------------------------
const FIRST = ['Arta', 'Blerim', 'Drita', 'Endrit', 'Fatjona', 'Gentrit', 'Hana', 'Ilir', 'Jeta', 'Kaltrina', 'Leart', 'Lirie', 'Mergim', 'Nora', 'Olti', 'Petrit', 'Rina', 'Shpend', 'Teuta', 'Uran', 'Valon', 'Vesa', 'Yll', 'Zana', 'Ardian', 'Besa', 'Dardan', 'Egzon', 'Flaka', 'Granit'];
const LAST = ['Krasniqi', 'Berisha', 'Gashi', 'Hoxha', 'Morina', 'Shala', 'Bytyqi', 'Kelmendi', 'Rexhepi', 'Ahmeti', 'Hyseni', 'Mustafa', 'Sylejmani', 'Bajrami', 'Kastrati'];
const PLACES = {
	XK: ['Prishtinë', 'Fushë Kosovë', 'Ferizaj', 'Gjilan', 'Pejë', 'Prizren', 'Mitrovicë', 'Vushtrri'],
	AL: ['Tiranë', 'Durrës', 'Shkodër', 'Vlorë', 'Elbasan'],
	MK: ['Shkup', 'Tetovë', 'Gostivar', 'Kumanovë', 'Strugë']
};
const PREFIX = { XK: '+3834', AL: '+3556', MK: '+3897' };
const CHANNEL = () => weighted([['instagram', 50], ['tiktok', 20], ['messenger', 12], ['whatsapp', 8], ['direct', 10]]);
const person = (country = 'XK') => ({
	customerName: `${pick(FIRST)} ${pick(LAST)}`,
	phone: `${PREFIX[country]}${Math.floor(1000000 + rnd() * 8999999)}`,
	city: pick(PLACES[country]),
	address: `Rruga ${pick(['Dardania', 'UÇK', 'Skënderbeu', 'Nëna Terezë', 'Adem Jashari', 'Ilirida'])} ${1 + Math.floor(rnd() * 90)}`
});

/** A finished order: made, sent, delivered and paid, with plausible gaps between steps. */
function history(created, method, { paid = true, status = 'delivered' } = {}) {
	const shipped = created + (1 + Math.floor(rnd() * 2)) * DAY;
	const delivered = shipped + (method === 'post' ? 1 + Math.floor(rnd() * 3) : 0) * DAY;
	return {
		status,
		createdAt: created,
		shippedAt: ['shipped', 'delivered', 'returned'].includes(status) ? shipped : null,
		deliveredAt: status === 'delivered' ? delivered : null,
		paidAt: paid && status === 'delivered' ? delivered + (method === 'post' ? 3 * DAY : 0) : null,
		alreadyMade: !['new', 'in_production'].includes(status),
		isDemo: true
	};
}

const START = ts(2026, 6, 20);
const END = ts(2026, 9, 21);
const when = () => START + Math.floor(rnd() * (END - START));
const demo = [];
const add = (input, extra, images) => demo.push({ input: { shippingFee: 0, discount: 0, ...input }, extra, images });

// The bulk client: 13 shirts at 20 € each, handed over in person.
add(
	{ kind: 'sale', ...person('XK'), customerName: 'Klubi Sportiv Dardanët', channel: 'direct', deliveryMethod: 'manual', paymentStatus: 'paid', paymentMethod: 'cash', shippingCost: 0, notes: 'Porosi me shumicë për ekipin.', items: [item(8, 20, { color: 'Black' }), item(5, 20, { color: 'White' })] },
	history(ts(2026, 8, 12), 'manual')
);
add(
	{ kind: 'sale', ...person('XK'), channel: 'direct', deliveryMethod: 'manual', paymentStatus: 'paid', paymentMethod: 'cash', shippingCost: 0, notes: 'Për një dasmë — 6 copë me çmim të veçantë.', items: [item(6, 22)] },
	history(ts(2026, 7, 26), 'manual')
);

// Influencer gifts.
for (const [handle, d] of [['@elona.style', ts(2026, 7, 2)], ['@driloni', ts(2026, 7, 19)], ['@kosovo.streetwear', ts(2026, 8, 8)], ['@tirana.fits', ts(2026, 8, 30)]]) {
	const country = handle.includes('tirana') ? 'AL' : 'XK';
	add(
		{ kind: 'gift', ...person(country), channel: 'instagram', deliveryMethod: 'post', paymentStatus: 'paid', paymentMethod: 'cash_on_delivery', country, notes: `Influencer ${handle} — pritet reel/story.`, items: [item(1, 0)] },
		history(d, 'post', { paid: false })
	);
}

// Personalised prints, each with front + back mockups.
const mock = (slug) => {
	if (!args.mockups) return null;
	const f = join(args.mockups, `${slug}-front.jpg`);
	const b = join(args.mockups, `${slug}-back.jpg`);
	if (!existsSync(f) || !existsSync(b)) return null;
	return { front: { mime: 'image/jpeg', data: readFileSync(f).toString('base64') }, back: { mime: 'image/jpeg', data: readFileSync(b).toString('base64') } };
};
const customs = [
	['ardit', ts(2026, 7, 14), 'delivered'],
	['elira', ts(2026, 8, 3), 'delivered'],
	['besart', ts(2026, 8, 25), 'delivered'],
	['dea', ts(2026, 9, 17), 'shipped'],
	['gent', ts(2026, 9, 22), 'new']
];
for (const [slug, d, status] of customs) {
	const pics = mock(slug);
	if (!pics) continue;
	add(
		{ kind: 'sale', ...person('XK'), channel: pick(['instagram', 'direct']), deliveryMethod: 'post', paymentStatus: status === 'delivered' ? 'paid' : 'unpaid', paymentMethod: 'cash_on_delivery', notes: 'Emër dhe numër sipas kërkesës.', items: [item(1, 30, { designId: null, isCustom: true, color: slug === 'elira' || slug === 'dea' ? 'White' : 'Black' })] },
		history(d, 'post', { status }),
		{ 0: pics }
	);
}

// Recent open orders, so the dashboard has work on it.
const openPlan = [
	['new', 'post', 'XK'], ['new', 'post', 'AL'], ['new', 'manual', 'XK'], ['in_production', 'post', 'MK'],
	['in_production', 'post', 'XK'], ['ready', 'post', 'XK'], ['ready', 'post', 'AL'], ['ready', 'manual', 'XK'],
	['shipped', 'post', 'XK'], ['shipped', 'post', 'MK']
];
for (const [status, method, country] of openPlan) {
	const qty = rnd() < 0.2 ? 2 : 1;
	add(
		{ kind: 'sale', ...person(country), country, channel: CHANNEL(), deliveryMethod: method, paymentStatus: 'unpaid', paymentMethod: method === 'post' ? 'cash_on_delivery' : 'cash', items: [item(qty, 25)] },
		history(END - Math.floor(rnd() * 4) * DAY, method, { status, paid: false })
	);
}

// Returned and cancelled, because it happens.
add({ kind: 'sale', ...person('AL'), country: 'AL', channel: 'tiktok', deliveryMethod: 'post', paymentStatus: 'unpaid', paymentMethod: 'cash_on_delivery', notes: 'Klienti nuk u përgjigj në telefon.', items: [item(1, 25)] }, history(ts(2026, 8, 18), 'post', { status: 'returned', paid: false }));
add({ kind: 'sale', ...person('XK'), channel: 'instagram', deliveryMethod: 'post', paymentStatus: 'unpaid', paymentMethod: 'cash_on_delivery', notes: 'Refuzoi pakon.', items: [item(1, 25)] }, history(ts(2026, 9, 6), 'post', { status: 'returned', paid: false }));
add({ kind: 'sale', ...person('XK'), channel: 'messenger', deliveryMethod: 'post', paymentStatus: 'unpaid', paymentMethod: 'cash_on_delivery', notes: 'E anuloi para se të printohej.', items: [item(1, 25)] }, history(ts(2026, 8, 21), 'post', { status: 'cancelled', paid: false }));

// Fill the rest with ordinary delivered orders, mostly hand deliveries in Kosovo
// (the courier export above covers the post side).
while (orders.length + demo.length < TOTAL) {
	const manual = rnd() < 0.62;
	const country = manual ? 'XK' : weighted([['XK', 60], ['AL', 20], ['MK', 20]]);
	const qty = weighted([[1, 78], [2, 17], [3, 5]]);
	const unpaid = !manual && rnd() < 0.12;
	add(
		{ kind: 'sale', ...person(country), country, channel: CHANNEL(), deliveryMethod: manual ? 'manual' : 'post', paymentStatus: unpaid ? 'unpaid' : 'paid', paymentMethod: manual ? 'cash' : 'cash_on_delivery', discount: qty > 1 && rnd() < 0.4 ? 5 : 0, items: [item(qty, 25)] },
		history(when(), manual ? 'manual' : 'post', { paid: !unpaid })
	);
}

// Oldest first, so order codes run in date order.
const all = [...orders, ...demo].sort((a, b) => a.extra.createdAt - b.extra.createdAt);

// ---- Demo expenses, in step with the shirts above ----------------------------
const shirts = all.filter((o) => o.extra.status !== 'cancelled').reduce((a, o) => a + o.input.items.reduce((s, i) => s + i.quantity, 0), 0);
const expenses = [];
const buys = [[ts(2026, 6, 16), 40], [ts(2026, 7, 10), 40], [ts(2026, 8, 5), 45], [ts(2026, 9, 1), Math.max(20, shirts - 125 + 15)]];
for (const [date, qty] of buys) expenses.push({ date, category: 'blanks', description: `Oversized 200gr · e zezë/e bardhë · ${qty} copë × 8 €`, quantity: qty, amount: qty * 8, isDemo: true });
const sheets = Math.ceil(shirts / 4) + 2;
const sheetBuys = [Math.round(sheets * 0.25), Math.round(sheets * 0.25), Math.round(sheets * 0.3)];
sheetBuys.push(sheets - sheetBuys.reduce((a, b) => a + b, 0));
[[ts(2026, 6, 18)], [ts(2026, 7, 15)], [ts(2026, 8, 10)], [ts(2026, 9, 5)]].forEach(([date], i) =>
	expenses.push({ date, category: 'dtf', description: 'Fletë 56×100 cm (UÇK, Shqiponja, të personalizuara)', quantity: sheetBuys[i], amount: sheetBuys[i] * 12, isDemo: true })
);
expenses.push({ date: ts(2026, 6, 16), category: 'packaging', description: '100 qese paketimi', quantity: 100, amount: 12, isDemo: true });
expenses.push({ date: ts(2026, 8, 20), category: 'packaging', description: '100 qese paketimi', quantity: 100, amount: 12, isDemo: true });
expenses.push({ date: ts(2026, 8, 1), category: 'marketing', description: 'Reklamë e sponsorizuar në Instagram', amount: 30, isDemo: true });
expenses.push({ date: ts(2026, 9, 10), category: 'marketing', description: 'Reklamë në TikTok', amount: 25, isDemo: true });

const payload = { orders: all, expenses };
writeFileSync(args.out ?? 'import-payload.json', JSON.stringify(payload));
const count = (f) => all.filter(f).length;
console.log(JSON.stringify({
	orders: all.length,
	real: count((o) => !o.extra.isDemo),
	demo: count((o) => o.extra.isDemo),
	gifts: count((o) => o.input.kind === 'gift'),
	custom: count((o) => o.input.items.some((i) => i.isCustom)),
	manual: count((o) => o.input.deliveryMethod === 'manual'),
	shirts,
	expenses: expenses.length
}));
