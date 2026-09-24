import { error, json } from '@sveltejs/kit';
import * as m from '$lib/server/mutations';
import type { RequestHandler } from './$types';

/**
 * One endpoint for every write. The pages call these by name through
 * $lib/client/actions, which keeps the page code identical to when the
 * database lived in the browser.
 */
const ops = {
	setOrderStatus: m.setOrderStatus,
	setPaymentStatus: m.setPaymentStatus,
	editOrder: m.editOrder,
	markAsMade: m.markAsMade,
	deleteOrder: m.deleteOrder,
	shipOrders: m.shipOrders,
	deliverOrders: m.deliverOrders,
	settleOrders: m.settleOrders,
	setCustomPrintReady: m.setCustomPrintReady,
	changeStock: m.changeStock,
	addBlank: m.addBlank,
	setDtfStock: m.setDtfStock,
	setOnOrder: m.setOnOrder,
	receiveDtf: m.receiveDtf,
	createDesign: m.createDesign,
	renameDesign: m.renameDesign,
	toggleArchive: m.toggleArchive,
	setShirtsPerSheet: m.setShirtsPerSheet,
	saveCostSettings: m.saveCostSettings,
	addExpense: m.addExpense,
	deleteExpense: m.deleteExpense,
	buyBlanks: m.buyBlanks,
	buyDtf: m.buyDtf,
	clearDemoData: m.clearDemoData
} as const;

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json().catch(() => null)) as { op?: string; args?: unknown[] } | null;
	if (!body?.op || !(body.op in ops) || !Array.isArray(body.args)) throw error(400, 'Bad request');

	const fn = ops[body.op as keyof typeof ops] as (...a: unknown[]) => Promise<unknown>;
	try {
		return json({ result: (await fn(locals.db, ...body.args)) ?? null });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Diçka shkoi keq' }, { status: 500 });
	}
};
