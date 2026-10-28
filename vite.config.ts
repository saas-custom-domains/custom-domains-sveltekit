import { defineConfig, loadEnv, type Plugin } from 'vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { createProxyHeaders } from './src/lib/server/proxy-headers.ts';

// server.js does this in production. Same thing for `vite dev` and
// `vite preview`, so requests through the proxy work there too.
function proxyHeaders(token: string | undefined): Plugin {
	const trustProxyHeaders = createProxyHeaders({ token, proxyProtocol: 'http' });
	const middleware = (
		req: Parameters<typeof trustProxyHeaders>[0],
		res: import('node:http').ServerResponse,
		next: () => void
	) => {
		if (trustProxyHeaders(req)) return next();
		res.writeHead(403, { 'content-type': 'text/plain' }).end('Forbidden');
	};
	return {
		name: 'proxy-headers',
		configureServer: (server) => () => server.middlewares.use(middleware),
		configurePreviewServer: (server) => () => server.middlewares.use(middleware)
	};
}

export default defineConfig(({ mode }) => ({
	plugins: [
		proxyHeaders(loadEnv(mode, process.cwd(), '').PROXY_AUTH_TOKEN),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		// Settings for unit tests are in .env.test
		include: ['src/**/*.test.ts']
	}
}));
