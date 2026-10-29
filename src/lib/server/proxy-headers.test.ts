import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createProxyHeaders } from './proxy-headers.ts';

const trust = createProxyHeaders({ token: 'test_token' });

function request(headers: Record<string, string>) {
	return { headers } as unknown as IncomingMessage;
}

// What SaaS Custom Domains sends: Host is your app, X-Served-For the
// customer's domain.
const proxied = {
	host: 'app.inkletter.app',
	'x-forwarded-host': 'app.inkletter.app',
	'x-forwarded-proto': 'https',
	'x-served-for': 'news.acme.com',
	'x-saas-domains-auth-token': 'test_token'
};

describe('createProxyHeaders', () => {
	it('gives SvelteKit the customer domain once the token checks out', () => {
		const req = request({ ...proxied });
		expect(trust(req)).toBe(true);
		expect(req.headers.host).toBe('news.acme.com');
		expect(req.headers['x-forwarded-proto']).toBe('https');
	});

	it('refuses X-Served-For without the right token', () => {
		const spoofed = { ...proxied, 'x-saas-domains-auth-token': 'nope' };
		expect(trust(request(spoofed))).toBe(false);
		delete (spoofed as Partial<typeof spoofed>)['x-saas-domains-auth-token'];
		expect(trust(request(spoofed))).toBe(false);
	});

	it('refuses X-Served-For when no token is configured', () => {
		const unset = createProxyHeaders({ token: undefined });
		expect(unset(request({ ...proxied, 'x-saas-domains-auth-token': '' }))).toBe(false);
		expect(unset(request({ ...proxied }))).toBe(false);
	});

	it('leaves direct requests alone', () => {
		const req = request({ host: 'localhost:3000' });
		expect(trust(req)).toBe(true);
		expect(req.headers.host).toBe('localhost:3000');
		expect(req.headers['x-forwarded-proto']).toBe('http');

		const behindLoadBalancer = request({ host: 'app.inkletter.app', 'x-forwarded-proto': 'https' });
		trust(behindLoadBalancer);
		expect(behindLoadBalancer.headers['x-forwarded-proto']).toBe('https');
	});

	it("keeps the proxy's protocol, https if it sent none", () => {
		const local = request({ ...proxied, 'x-forwarded-proto': 'http' });
		trust(local);
		expect(local.headers['x-forwarded-proto']).toBe('http');

		const req = request({ ...proxied });
		delete req.headers['x-forwarded-proto'];
		trust(req);
		expect(req.headers['x-forwarded-proto']).toBe('https');
	});
});
