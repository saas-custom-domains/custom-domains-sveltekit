import { isActiveHost } from '#lib/server/domains.ts';
import { normalizeHost } from '#lib/server/hosts.ts';
import type { RequestHandler } from './$types';

// Caddy calls this before issuing a certificate on demand
// (DOMAINS_PROVIDER=caddy). 200 = go ahead, anything else = refuse.
export const GET: RequestHandler = ({ url }) => {
	const domain = url.searchParams.get('domain') ?? '';
	const ok = isActiveHost(normalizeHost(domain));
	return new Response(null, { status: ok ? 200 : 404 });
};
