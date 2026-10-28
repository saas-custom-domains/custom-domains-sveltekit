import { APP_DOMAIN, APP_HOSTS } from '$app/env/private';

// "Acme.Example.com." and "acme.example.com:443" are the same host.
export function normalizeHost(input: string): string {
	return input.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

const appHosts = APP_HOSTS.map(normalizeHost);
const appDomain = APP_DOMAIN ? normalizeHost(APP_DOMAIN) : undefined;

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function isValidHost(host: string): boolean {
	if (host.length > 253) return false;
	const labels = host.split('.');
	return labels.length >= 2 && labels.every((label) => LABEL.test(label));
}

// Hosts that serve the dashboard, not a publication.
export function isAppHost(host: string): boolean {
	return appHosts.includes(host);
}

// Customers can't connect our own domain or anything under it.
export function isReservedHost(host: string): boolean {
	if (isAppHost(host)) return true;
	if (!appDomain) return false;
	return host === appDomain || host.endsWith(`.${appDomain}`);
}
