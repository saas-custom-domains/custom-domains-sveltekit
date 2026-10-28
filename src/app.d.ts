import type { Publication } from '#lib/server/domains.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			// Set by hooks.server.ts on a customer's domain.
			publication?: Publication;
		}
	}
}

export {};
