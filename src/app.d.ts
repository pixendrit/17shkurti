declare global {
	namespace App {
		interface Locals {
			db: D1Database;
		}
		interface Platform {
			env: {
				DB: D1Database;
				APP_PIN: string;
				SESSION_SECRET: string;
			};
		}
		interface PageData {
			error?: string;
		}
	}
}

export {};
