import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from './db.ts';
import { addDomain, removeDomain } from './domain-service.ts';
import { findDomain, insertDomain } from './domains.ts';
import { SaasDomainsError } from './saas-domains.ts';

afterEach(() => vi.unstubAllGlobals());

function stubApi(status: number, body: object | string = {}) {
	const fetch = vi.fn(async () =>
		typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status })
	);
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

describe('addDomain', () => {
	it('stores the provider uuid and sends the DNS contact', async () => {
		const fetch = stubApi(201, { uuid: 'dom_1', host: 'a.example.com', status: 'pending_check' });
		const domain = await addDomain(1, 'a.example.com', 'it@example.com');
		expect(findDomain(domain.id)?.provider_uuid).toBe('dom_1');

		const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(JSON.parse(String(init.body))).toEqual({
			host: 'a.example.com',
			instructions_recipient: 'it@example.com'
		});
	});

	it("doesn't keep the row when the API refuses the domain", async () => {
		stubApi(400, { error: 'Host has already been taken', error_code: 'host_taken' });
		const error = await addDomain(1, 'taken.example.com').catch((e) => e);
		expect(error).toBeInstanceOf(SaasDomainsError);
		expect(error.code).toBe('host_taken');
		const left = db().prepare('SELECT 1 FROM custom_domains WHERE host = ?').get('taken.example.com');
		expect(left).toBeUndefined();
	});
});

describe('removeDomain', () => {
	it('treats 404 from the API as already removed', async () => {
		stubApi(404, { error: 'Custom domain dom_2 not found.', error_code: 'not_found' });
		const domain = insertDomain(2, 'gone.example.com');
		await removeDomain({ ...domain, provider_uuid: 'dom_2' });
		expect(findDomain(domain.id)).toBeNull();
	});

	it('keeps the row when the API fails', async () => {
		stubApi(500, 'oops');
		const domain = insertDomain(2, 'retry.example.com');
		await expect(removeDomain({ ...domain, provider_uuid: 'dom_3' })).rejects.toThrow('500');
		expect(findDomain(domain.id)).not.toBeNull();
	});
});
