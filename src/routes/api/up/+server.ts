// Health check for Docker and load balancers. hooks.server.ts lets it
// through on any host, because load balancers call it by IP address.
export const GET = () => new Response('ok');
