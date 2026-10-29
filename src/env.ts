import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;
const list = (fallback: string) => (value: string | undefined) =>
	(value || fallback)
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);

// Server-only settings, read when the app starts. See .env.example.
export const variables = defineEnvVars({
	APP_HOSTS: {
		description: 'Hostnames that serve the dashboard, comma-separated, no port',
		schema: list('localhost')
	},
	APP_DOMAIN: {
		description: "Your own domain. Customers can't connect it or its subdomains",
		schema: optional
	},
	PROXY_AUTH_TOKEN: {
		description: "The upstream's auth token, sent as X-SaaS-Domains-Auth-Token",
		schema: optional
	},
	SCD_WEBHOOK_TOKEN: { description: 'The token on your webhook', schema: optional },
	SCD_API_URL: { schema: (value) => value || 'https://app.saascustomdomains.com' },
	SCD_API_TOKEN: { schema: optional },
	SCD_ACCOUNT_UUID: { schema: optional },
	SCD_UPSTREAM_UUID: { schema: optional },
	DATABASE_PATH: {
		description: 'SQLite file, or :memory:',
		schema: (value) => value || 'data/app.db'
	}
});
