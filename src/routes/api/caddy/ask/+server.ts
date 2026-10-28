import { isActiveHost } from '#lib/server/domains.ts';
import { normalizeHost } from '#lib/server/hosts.ts';
import type { RequestHandler } from './$types';

// Caddy calls this before issuing a certificate on demand
// (DOMAINS_PROVIDER=caddy). 200 = go ahead, anything else = refuse.
export const GET: RequestHandler = ({ url }) => {
	const host = normalizeHost(url.searchParams.get('domain') ?? '');
	return new Response(null, { status: isActiveHost(host) ? 200 : 404 });
};
