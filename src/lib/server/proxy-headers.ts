import type { IncomingMessage } from 'node:http';
import { secureCompare } from './secure-compare.ts';

type Options = {
	// The upstream's auth token (PROXY_AUTH_TOKEN). If it's unset, every
	// request with X-Served-For is refused.
	token: string | undefined;
	// What browsers use on customer domains: https in production.
	// scd-mock serves plain HTTP, so compose.yaml sets it to http.
	proxyProtocol?: string;
};

// Runs before SvelteKit sees the request (server.js in production, a
// Vite plugin in dev), because SvelteKit checks the Origin of form
// posts before any hook, even `handle`, runs.
//
// Behind SaaS Custom Domains, Host is your app's own hostname and the
// customer's domain arrives in X-Served-For. Once the upstream's auth
// token proves the request came through the proxy, this hands SvelteKit
// the customer's domain as Host, so `event.url`, the CSRF check,
// redirects and absolute URLs all use it.
//
// Returns false if the request must be refused.
export function createProxyHeaders({ token, proxyProtocol = 'https' }: Options) {
	return (req: IncomingMessage): boolean => {
		const servedFor = req.headers['x-served-for'];

		if (servedFor === undefined) {
			// Your own domain, webhooks, health checks. Keep the protocol
			// your load balancer reports; a bare socket is plain HTTP.
			req.headers['x-forwarded-proto'] ??= 'http';
			return true;
		}

		const given = req.headers['x-saas-domains-auth-token'];
		if (typeof servedFor !== 'string') return false;
		if (typeof given !== 'string') return false;
		if (!secureCompare(given, token)) return false;

		req.headers.host = servedFor;
		req.headers['x-forwarded-proto'] = proxyProtocol;
		return true;
	};
}
