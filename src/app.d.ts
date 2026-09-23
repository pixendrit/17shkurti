import type { DB } from '$lib/data/types';

declare global {
	namespace App {
		interface Locals {
			db: DB;
		}
		interface Platform {
			env: {
				DB: D1Database;
				APP_PIN: string;
				SESSION_SECRET: string;
			};
		}
	}
}

export {};
