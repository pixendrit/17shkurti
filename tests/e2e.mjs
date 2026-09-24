/**
 * End-to-end: drives the real app in a browser through every page and the
 * shop's main flows. Run it against a local server with the migrated or demo
 * data loaded — it creates orders, so never point it at the live shop.
 *
 *   pnpm preview                                  # in one terminal
 *   node tests/e2e.mjs http://127.0.0.1:8787 <PIN>
 *
 * CHROMIUM=/path/to/chromium picks a browser other than Playwright's own.
 */
import { chromium } from 'playwright';
const B = process.argv[2] ?? 'http://127.0.0.1:8787', PIN = process.argv[3];
if (!PIN) throw new Error('usage: node tests/e2e.mjs <url> <pin>');
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

// A small picture to stand in for mockups and design artwork.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHUlEQVR4nGP8z8DAwMDAxMDAwMDAwMDAwMDAAAA7AAQPcn0RAAAAAElFTkSuQmCC', 'base64');
const picture = (name) => ({ name: `${name}.png`, mimeType: 'image/png', buffer: PNG });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };
const norm = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ');
const body = async () => norm(await p.locator('main').innerText());
const go = async (u) => { const r = await p.goto(B + u, { waitUntil: 'networkidle' }); return r?.status(); };
const alert = async () => (await p.locator('[role=alert]').count()) ? norm(await p.locator('[role=alert]').first().innerText()) : '';
const settle = () => p.waitForLoadState('networkidle').then(() => p.waitForTimeout(300));

// Login
await go('/login');
await p.locator('input[name="pin"]').fill(PIN);
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10000 });
check('logged in', !p.url().includes('/login'));

// Every page renders, fast
for (const path of ['/', '/orders', '/orders?tab=all', '/orders/new', '/shipments', '/stock', '/purchases', '/designs', '/stats', '/stats?days=0', '/settings', '/customers', '/more']) {
	const t0 = Date.now();
	const status = await go(path);
	check(`page ${path}`, status === 200 && !(await body()).includes('Diçka shkoi keq'), `${status} in ${Date.now() - t0} ms`);
}

// A sale: Albania, courier price from settings, estimate matches what is saved
await go('/orders/new');
await p.getByLabel('Emri *').fill('Test Shqipëri');
await p.getByLabel('Telefoni *').fill('+355 69 111 2233');
await p.getByLabel('Shteti').selectOption('AL');
await p.getByLabel('Burimi i porosisë').selectOption('tiktok');
await p.getByLabel('Masa').first().selectOption('M');
await p.getByLabel('Printi').first().selectOption({ label: 'Shqiponja' });
await p.getByLabel('Sasia').first().fill('2');
check('courier price placeholder for Albania', (await p.getByLabel('Posta na kushton €').getAttribute('placeholder')) === '5');
const est = await body();
check('estimate: 50 € in, 31,12 € cost, 18,88 € profit', est.includes('31,12 €') && est.includes('18,88 €'), est.slice(est.indexOf('copë'), est.indexOf('copë') + 60));
await p.getByRole('button', { name: 'Ruaj porosinë' }).click();
await p.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
const sale = p.url().replace(B, '');
let t = await body();
check('order saved with its economics', ['Të ardhurat 50 €', 'Bluzat pa print 16 €', 'DTF 6 €', 'Puna 4 €', 'Paketimi 0,12 €', 'Posta 5 €', 'Fitimi 18,88 €'].every((s) => t.replace(/− /g, '').includes(s)), t.slice(t.indexOf('Nëntotali'), t.indexOf('Nëntotali') + 200));

// Making it without the DTF prints on the shelf is refused, and says why
await p.getByRole('button', { name: 'U bë — merr nga stoku' }).click(); await settle();
check('make refused without prints', (await alert()).includes('mungon 2 × Print DTF: Shqiponja · bluzë e zezë'), await alert());
check('waiting list names what is missing', (await body()).includes('Ende nuk mund të bëhet'));

// Buy a DTF sheet with 8 Shqiponja-on-black prints
await go('/purchases?kind=dtf');
await p.getByLabel('Fletë', { exact: true }).fill('2');
const row = p.locator('label', { hasText: 'Shqiponja' }).filter({ hasText: 'e zezë' });
await row.locator('input[inputmode=numeric]').fill('8');
await p.getByRole('button', { name: 'Ruaj blerjen' }).click(); await settle();
check('DTF purchase recorded', (await body()).includes('2 fletë: 8 × Shqiponja · bluzë e zezë'));

// Now it can be made; stock goes down; then courier, delivery, payment
await go(sale);
check('now ready to make', (await body()).includes('mund të bëhet tani'));
await p.getByRole('button', { name: 'U bë — merr nga stoku' }).click(); await settle();
t = await body();
check('made: waiting for the courier, stock taken', t.includes('Pret postierin') && t.includes('Përdorur për porosi: Print DTF: Shqiponja · bluzë e zezë -2'), await alert());
await go('/shipments');
const code = (await p.locator('li', { hasText: 'Test Shqipëri' }).first().innerText()).match(/HS-\d+/)?.[0];
await p.locator('li', { hasText: code }).locator('input[type=checkbox]').check();
await p.getByRole('button', { name: /Iu dhanë postierit/ }).click(); await settle();
await p.locator('section', { hasText: 'Te postieri' }).locator('li', { hasText: code }).locator('input[type=checkbox]').check();
await p.getByRole('button', { name: /U dorëzuan \(1\)/ }).first().click(); await settle();
await p.locator('section', { hasText: 'pa u paguar' }).locator('li', { hasText: code }).locator('input[type=checkbox]').check();
await p.getByRole('button', { name: /Posta i pagoi/ }).click(); await settle();
await go(sale);
t = await body();
check('delivered and paid by the courier', t.includes('E dorëzuar') && t.includes('E paguar') && t.includes('Pagesë në dorëzim 50 €'), t.slice(0, 120));

// Undo: delivered -> back with the courier, and forward again
await p.getByRole('button', { name: 'Zhbëj hapin e fundit' }).click(); await settle();
check('undo steps back', (await body()).includes('Te postieri'));
await p.getByRole('button', { name: 'U dorëzua', exact: true }).click(); await settle();

// Personalised shirt: refused without mockups, then made once its print is back
await go('/orders/new');
await p.getByLabel('Emri *').fill('Test Personalizuar');
await p.getByLabel('Telefoni *').fill('+383 44 999 000');
await p.getByLabel('Printi').first().selectOption('custom');
check('mockup fields required in the browser', (await p.locator('input[type=file][required]').count()) === 2);
{
	await p.locator('input[name^=front-]').setInputFiles(picture('front'));
	await p.locator('input[name^=back-]').setInputFiles(picture('back'));
	await p.waitForTimeout(800);
	check('previews shown', (await p.locator('img[alt^=Mockup]').count()) === 2);
	await p.getByRole('button', { name: 'Ruaj porosinë' }).click();
	await p.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
	t = await body();
	check('custom order saved with both mockups', (await p.locator('img[alt^="Mockup"]').count()) === 2 && t.includes('Print i personalizuar'));
	const img = await p.locator('img[alt="Mockup para"]').evaluate((i) => i.naturalWidth);
	check('mockup image served', img > 0, `${img}px`);
	await p.getByRole('button', { name: 'U bë — merr nga stoku' }).click(); await settle();
	check('custom make waits for its print', (await alert()).includes('personalizuar'), await alert());
	await p.getByRole('button', { name: 'Shëno: printi DTF ka ardhur' }).click(); await settle();
	await p.getByRole('button', { name: 'U bë — merr nga stoku' }).click(); await settle();
	check('custom made once the print is back', (await body()).includes('Pret postierin'), await alert());
}

// A hand-delivered bulk order paid in cash up front, and a gift
await go('/orders/new');
await p.getByLabel('Emri *').fill('Test Bulk');
await p.getByLabel('Telefoni *').fill('049 123 456');
await p.getByRole('button', { name: 'Dorëzim personal' }).click();
await p.getByLabel('Printi').first().selectOption({ label: 'UÇK' });
await p.getByLabel('Sasia').first().fill('13');
await p.getByLabel('Çmimi për copë €').first().fill('20');
await p.getByLabel('E paguar tashmë?').selectOption('cash');
await p.getByRole('button', { name: 'Ruaj porosinë' }).click();
await p.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
t = await body();
check('bulk: 13 × 20 € paid in cash, no courier', t.includes('Të ardhurat 260 €') && t.includes('E paguar') && t.includes('Dorëzimi 0 €'), t.slice(t.indexOf('Nëntotali'), t.indexOf('Nëntotali') + 160));

await go('/orders/new');
await p.getByRole('button', { name: 'Dhuratë / influencer' }).click();
await p.getByLabel('Emri *').fill('Test Influencer');
await p.getByLabel('Telefoni *').fill('044 777 888');
await p.getByLabel('Printi').first().selectOption({ label: 'UÇK' });
await p.getByRole('button', { name: 'Ruaj porosinë' }).click();
await p.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
const gift = p.url().replace(B, '');
t = await body();
check('gift: free, a marketing cost', t.includes('Dhuratë') && t.includes('Kosto marketingu 15,62 €'), t.slice(t.indexOf('Artikujt'), t.indexOf('Artikujt') + 200));

// Edit the gift's details; a returning phone number goes to the same customer
await p.getByRole('button', { name: 'Ndrysho' }).click();
await p.getByLabel('Qyteti').fill('Ferizaj');
await p.getByLabel('Shënime').fill('Video në TikTok');
await p.getByRole('button', { name: 'Ruaj', exact: true }).click(); await settle();
t = await body();
check('edit saved', t.includes('Ferizaj') && t.includes('Video në TikTok'), await alert());

await go('/orders/new');
await p.getByLabel('Emri *').fill('Test Shqipëri');
await p.getByLabel('Telefoni *').fill('00355691112233');
await p.getByLabel('Printi').first().selectOption({ label: 'Shqiponja' });
await p.getByRole('button', { name: 'Ruaj porosinë' }).click();
await p.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
check('same phone, same customer: history shown', (await body()).includes('Porositë e tjera të klientit (1)'));
await p.getByRole('button', { name: 'Fshi porosinë' }).click({ trial: false }).catch(() => {});
p.once('dialog', (d) => d.accept());
await p.getByRole('button', { name: 'Fshi porosinë' }).click(); await p.waitForURL(/\/orders$/);
check('order deleted', p.url().endsWith('/orders'));

// Stock count correction goes into the ledger
await go('/stock');
await p.getByLabel('Çfarë').selectOption({ label: 'Oversized 200gr · E zezë · XXL' });
await p.getByLabel('Sa ka').fill('3');
await p.getByLabel('Shënim').fill('numërim');
await p.getByRole('button', { name: 'Ruaj', exact: true }).click(); await settle();
await p.getByRole('button', { name: 'Lëvizjet' }).click();
check('count recorded as an adjustment', (await body()).includes('Rregullim · numërim'), await alert());

// A new design, printed on both colours; an image upload
await go('/designs');
await p.getByRole('button', { name: 'Dizajn i ri' }).click();
await p.getByLabel('Emri *').fill('Test Dardania');
await p.getByLabel('Sa bluza (para + pas) në një fletë').fill('5');
await p.getByRole('button', { name: 'Ruaj dizajnin' }).click(); await settle();
check('design created with two prints', (await p.locator('section', { hasText: 'Test Dardania' }).locator('text=Mbi bluzë').count()) === 2, await alert());
{
	await p.locator('section', { hasText: 'Test Dardania' }).locator('input[type=file]').first().setInputFiles(picture('front'));
	await p.waitForTimeout(2500); await settle();
	check('design picture uploaded', (await p.locator('section', { hasText: 'Test Dardania' }).locator('img').count()) >= 1, await alert());
}
const dupe = async () => {
	await p.getByRole('button', { name: 'Dizajn i ri' }).click();
	await p.getByLabel('Emri *').fill('test dardania');
	await p.getByRole('button', { name: 'Ruaj dizajnin' }).click(); await settle();
	return alert();
};
check('duplicate design name refused', (await dupe()).includes('Ekziston'));

// Settings: a new labour cost applies to new orders only
await go('/settings');
await p.getByLabel('Puna për bluzë €').fill('2,50');
await p.getByRole('button', { name: 'Ruaj cilësimet' }).click(); await settle();
check('settings saved', (await body()).includes('U ruajt'), await alert());
await go(gift);
check('old order keeps its labour cost', (await body()).includes('Puna 2 €'));
await go('/settings');
await p.getByLabel('Puna për bluzë €').fill('2');
await p.getByRole('button', { name: 'Ruaj cilësimet' }).click(); await settle();

// Search and customers
await go('/orders?q=Influencer');
check('search finds by name', (await body()).includes('Test Influencer'));
await go('/customers?q=Influencer');
check('customer listed', (await body()).includes('Test Influencer'));

// Mobile: no page scrolls sideways
await p.setViewportSize({ width: 390, height: 844 });
for (const path of ['/', '/orders', '/orders/new', sale, '/shipments', '/stock', '/purchases', '/designs', '/stats', '/settings', '/customers']) {
	await go(path);
	const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	check(`mobile ${path.slice(0, 20)} fits`, over <= 0, `${over}px over`);
}

check('no browser errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
