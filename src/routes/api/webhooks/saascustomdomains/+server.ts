import { SCD_WEBHOOK_TOKEN } from '$app/env/private';
import { findDomainByProviderUuid, setHttpsReady, setStatus } from '#lib/server/domains.ts';
import { secureCompare } from '#lib/server/secure-compare.ts';
import type { RequestHandler } from './$types';

// Events: https://docs.saascustomdomains.com/webhooks
export const POST: RequestHandler = async ({ request, url }) => {
	if (!secureCompare(url.searchParams.get('token'), SCD_WEBHOOK_TOKEN)) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { event, domain: payload } = await request.json();
	const domain = payload?.uuid ? findDomainByProviderUuid(payload.uuid) : null;
	// Not ours (or already removed): acknowledge so it isn't retried.
	if (!domain) return new Response(null, { status: 204 });

	switch (event) {
		case 'domain_dns_proxy_record_valid':
			setStatus(domain.id, 'active');
			break;
		case 'domain_dns_proxy_record_invalid':
			setStatus(domain.id, 'pending');
			break;
		case 'tls_certificate_issued':
			setHttpsReady(domain.id);
			break;
	}
	return new Response(null, { status: 204 });
};
