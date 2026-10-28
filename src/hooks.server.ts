import type { Handle } from '@sveltejs/kit/hooks';
import { findPublicationByActiveHost } from '#lib/server/domains.ts';
import { isAppHost, normalizeHost } from '#lib/server/hosts.ts';

// Every request picks its publication here, and nowhere else.
// By now proxy-headers.ts has checked the proxy's token and made
// event.url the address the visitor sees, customer domain included.
export const handle: Handle = async ({ event, resolve }) => {
	// Load balancers call the health check by IP address.
	if (event.url.pathname === '/api/up') return resolve(event);

	const host = normalizeHost(event.url.hostname);

	// X-Served-For without a matching host means proxy-headers.ts didn't
	// run (the app was started with `node build`), so nothing checked
	// the token. Refuse rather than guess.
	const servedFor = event.request.headers.get('x-served-for');
	if (servedFor !== null && normalizeHost(servedFor) !== host) {
		console.error('X-Served-For was not checked. Start the app with `node server.js`.');
		return new Response('Forbidden', { status: 403 });
	}

	const isPublicationRoute = event.route.id?.startsWith('/(publication)') ?? false;

	if (isAppHost(host)) {
		// Publications are only reachable on their own domain.
		if (!isPublicationRoute) return resolve(event);
		if (event.url.pathname === '/') {
			return new Response(null, { status: 303, headers: { location: '/dashboard' } });
		}
		return new Response('Not found', { status: 404 });
	}

	const publication = findPublicationByActiveHost(host);
	if (!publication) return new Response('Unknown domain', { status: 404 });

	// The dashboard and the API are only reachable on your own hosts.
	if (event.route.id && !isPublicationRoute) {
		return new Response('Not found', { status: 404 });
	}

	event.locals.publication = publication;
	return resolve(event);
};
