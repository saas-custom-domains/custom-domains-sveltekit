// Production entry point: `node server.js` instead of `node build`.
// It's adapter-node's handler with src/lib/server/proxy-headers.ts in
// front of it.
import { createServer } from 'node:http';
import { createProxyHeaders } from './src/lib/server/proxy-headers.ts';

// adapter-node reads the protocol from this header (proxy-headers.ts
// sets it) and the host from Host. Must be set before the import.
process.env.PROTOCOL_HEADER = 'x-forwarded-proto';
const { handler } = await import('./build/handler.js');

const trustProxyHeaders = createProxyHeaders({
	token: process.env.PROXY_AUTH_TOKEN,
	proxyProtocol: process.env.PROXY_PROTOCOL
});

const server = createServer((req, res) => {
	if (!trustProxyHeaders(req)) {
		res.writeHead(403, { 'content-type': 'text/plain' });
		res.end('Forbidden');
		return;
	}
	handler(req, res, () => res.writeHead(404).end('Not found'));
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
server.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		server.close(() => process.exit(0));
		server.closeIdleConnections();
	});
}
