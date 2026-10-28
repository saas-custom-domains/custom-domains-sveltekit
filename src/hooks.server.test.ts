import type { RequestEvent } from '@sveltejs/kit';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { handle } from './hooks.server.ts';

// Calls handle() the way SvelteKit does, after proxy-headers.ts has run.
async function call(url: string, routeId: string | null, headers: Record<string, string> = {}) {
	const event = {
		url: new URL(url),
		request: new Request(url, { headers }),
		route: { id: routeId },
		locals: {}
	} as unknown as RequestEvent;
	let resolved = false;
	const response = await handle({
		event,
		resolve: async () => {
			resolved = true;
			return new Response('page');
		}
	});
	return { response, resolved, locals: event.locals };
}

beforeAll(() => {
	db().exec(`
		DELETE FROM custom_domains;
		INSERT INTO custom_domains (publication_id, host, status) VALUES
			(1, 'news.acme.com', 'active'),
			(2, 'news.globex.com', 'pending');
	`);
});

describe('handle', () => {
	it('serves the dashboard on the app host', async () => {
		const { resolved, locals } = await call('https://inkletter.app/dashboard', '/dashboard');
		expect(resolved).toBe(true);
		expect(locals.publication).toBeUndefined();
	});

	it('hides publication pages on the app host', async () => {
		const page = await call('https://inkletter.app/posts/x', '/(publication)/posts/[slug]');
		expect(page.response.status).toBe(404);
		const home = await call('https://inkletter.app/', '/(publication)');
		expect(home.response.status).toBe(303);
		expect(home.response.headers.get('location')).toBe('/dashboard');
	});

	it('finds the publication for an active custom domain', async () => {
		const { resolved, locals } = await call('https://news.acme.com/', '/(publication)');
		expect(resolved).toBe(true);
		expect(locals.publication?.slug).toBe('acme');
	});

	it('returns 404 for pending and unknown domains', async () => {
		expect((await call('https://news.globex.com/', '/(publication)')).response.status).toBe(404);
		expect((await call('https://evil.example/', '/(publication)')).response.status).toBe(404);
	});

	it('hides the dashboard and API on custom domains', async () => {
		const { response } = await call('https://news.acme.com/dashboard', '/dashboard');
		expect(response.status).toBe(404);
	});

	it('lets the health check through on any host', async () => {
		const { resolved } = await call('http://10.0.0.5:3000/api/up', '/api/up');
		expect(resolved).toBe(true);
	});

	it('refuses X-Served-For that proxy-headers.ts did not check', async () => {
		// e.g. the app was started with `node build` instead of server.js
		const { response } = await call('https://inkletter.app/', '/(publication)', {
			'x-served-for': 'news.acme.com'
		});
		expect(response.status).toBe(403);
	});
});
