import { resolve4, resolveCname } from 'node:dns/promises';
import { CNAME_TARGET, SERVER_IPS } from '$app/env/private';

// Used when you run the proxy yourself (DOMAINS_PROVIDER=caddy).
// With SaaS Custom Domains, the API checks DNS for you.
export async function pointsAtUs(host: string): Promise<boolean> {
	// *.localhost always resolves to this machine.
	if (host.endsWith('.localhost')) return true;

	const [cnames, ips] = await Promise.all([
		resolveCname(host).catch(() => []),
		resolve4(host).catch(() => [])
	]);
	return (
		cnames.some((c) => c.toLowerCase().replace(/\.$/, '') === CNAME_TARGET) ||
		ips.some((ip) => SERVER_IPS.includes(ip))
	);
}
