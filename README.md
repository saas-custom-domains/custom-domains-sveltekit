# Custom domains in SvelteKit

An example SvelteKit 3 app where each customer connects their own domain. It's a small newsletter platform, Inkletter: every publication gets a home page, posts and a subscribe form, and its owner can serve it on `news.theircompany.com` instead of an Inkletter URL.

It goes with the guide [How to Add Custom Domains to a SvelteKit App](https://saascustomdomains.com/blog/posts/custom-domains-sveltekit).

What's in it:

- `src/hooks.server.ts` finds the publication from the request's hostname and puts it in `event.locals`. Unknown and unverified domains get a 404.
- Requests from the [SaaS Custom Domains](https://saascustomdomains.com) proxy are accepted only with the upstream's auth token, so nobody can claim a customer's domain by sending `X-Served-For` themselves.
- Form actions work on custom domains, with SvelteKit's CSRF check left on (see [Form actions on customer domains](#form-actions-on-customer-domains)).
- A dashboard to add a domain, check its DNS and remove it. Webhooks update the status.
- Two ways to run HTTPS: SaaS Custom Domains (default), or your own Caddy with on-demand TLS.

## Run it in 2 minutes

You need Docker.

```bash
git clone https://github.com/saas-custom-domains/custom-domains-sveltekit
cd custom-domains-sveltekit
docker compose up --build
```

1. Open http://localhost:3000 and add `acme.localhost` to Acme Weekly.
2. Within a few seconds the status changes to **Live**: the mock API "found" the DNS records and sent a webhook.
3. Open http://acme.localhost. The request goes through the mock proxy on port 80, exactly like a real customer domain goes through SaaS Custom Domains, and you see Acme's publication. Try the subscribe form.

`*.localhost` always resolves to your own machine in Chrome, Firefox, Safari and curl, so there's nothing to add to `/etc/hosts`.

The mock is [scd-mock](https://github.com/saas-custom-domains/scd-mock): a local copy of the SaaS Custom Domains API and proxy, so you can try everything without an account.

### Without Docker

```bash
npm install
cp .env.example .env
npm run dev
```

Add a domain such as `acme.localhost` and open http://acme.localhost:5173. Without the mock, set `DOMAINS_PROVIDER=caddy` in `.env` so adding a domain doesn't call the API, then click **Check DNS**: `*.localhost` domains count as pointed at you.

Vite's dev server only answers for `localhost` and `*.localhost`. Any other domain gets "Blocked request. This host ("news.example.com") is not allowed."; add it to `server.allowedHosts` in `vite.config.ts` if you want to try a real domain in dev. Requests through the proxy aren't affected, because they arrive with your own hostname.

## How it works

```
Browser ── acme.com ──▶ SaaS Custom Domains ──▶ server.js ──▶ SvelteKit
                        (TLS certificate,       Host: app.inkletter.app
                         proxy)                 X-Served-For: acme.com
                                                X-SaaS-Domains-Auth-Token: …
```

| File | What it does |
| --- | --- |
| `server.js` | Starts adapter-node's handler with `proxy-headers.ts` in front |
| `src/lib/server/proxy-headers.ts` | Checks the proxy token, then gives SvelteKit the customer's domain |
| `src/hooks.server.ts` | Picks the publication from `event.url`, keeps each host to its own routes |
| `src/routes/(publication)/` | The customer's publication: home, posts, subscribe action |
| `src/routes/dashboard/` | Add, check and remove domains |
| `src/lib/server/domain-service.ts` | Add, check and remove domains with either provider |
| `src/lib/server/saas-domains.ts` | API client for SaaS Custom Domains |
| `src/routes/api/webhooks/saascustomdomains/+server.ts` | Webhook endpoint |
| `src/routes/api/caddy/ask/+server.ts` | Caddy's on-demand TLS check |

Publication pages live in the `(publication)` route group, so they share URLs with nothing else and `handle` can tell them apart by `event.route.id`. They're only served on an active custom domain; the dashboard and the API are only served on your own hosts.

### Form actions on customer domains

SaaS Custom Domains sends your app's own hostname in `Host` and `X-Forwarded-Host`, so your hosting platform routes the request to you and apps that only know their own domain keep working. The customer's domain arrives separately, in `X-Served-For`. SvelteKit builds `event.url` from `Host`, and it uses that URL for more than routing:

- Form actions. SvelteKit compares the browser's `Origin` with `event.url.origin`, and on a customer domain they differ. The post fails with `403` and the text `Cross-site POST form submissions are forbidden` (or `{"message":"Cross-site POST form submissions are forbidden"}` for a `use:enhance` form).
- Absolute URLs and redirects built from `event.url` or `page.url`, such as a canonical link, point at your app's hostname.

So if your app needs the customer's domain for forms or links, give it that domain before SvelteKit sees the request. That has to happen outside SvelteKit: the origin check runs in SvelteKit's request handler before `reroute` and `handle`, so `handle` can only see the result.

`server.js` runs adapter-node's `handler.js` behind `proxy-headers.ts`. When a request has `X-Served-For`, it checks `X-SaaS-Domains-Auth-Token` in constant time, refuses the request if it's wrong (or `PROXY_AUTH_TOKEN` isn't set), and otherwise sets `Host` to the customer's domain. From then on `event.url`, the CSRF check, redirects and absolute URLs all use `acme.com`. The CSRF check itself stays on: a form on another site that posts to `acme.com` still gets the 403. In `vite dev` and `vite preview` a small Vite plugin runs the same function.

Run the app with `node server.js`, not `node build`. If you forget, `hooks.server.ts` notices that `X-Served-For` doesn't match the host and returns 403.

Other things that don't work:

- `ORIGIN`. adapter-node 6 no longer reads it. Its replacement, `paths.origin` in `vite.config.ts`, is set at build time and is a single origin, so it can't cover your customers' domains.
- `HOST_HEADER=x-forwarded-host`, which the adapter-node docs suggest behind a proxy: that header holds your own hostname too.
- `HOST_HEADER=x-served-for`. It fixes the form, but SvelteKit then trusts the header before your token check has run. Check the token first, then hand over the domain.
- `csrf.trustedOrigins`. It's a fixed list of exact origins, chosen at build time. `['*']` turns the check off for every site, not just your customers'. (`csrf.checkOrigin` was removed in SvelteKit 3; the build now fails with "`config.csrf.checkOrigin` has been removed in favour of `csrf.trustedOrigins`".)

If you'd rather receive the customer's domain in `X-Forwarded-Host`, SaaS Custom Domains support can switch that on for your account; `proxy-headers.ts` works either way.

### HTTP and HTTPS

The origin SvelteKit compares includes the scheme, and adapter-node assumes `https` unless a protocol header says otherwise. `server.js` sets `PROTOCOL_HEADER=x-forwarded-proto`, and `proxy-headers.ts` fills that header in: requests from SaaS Custom Domains are always HTTPS, and direct requests keep what your load balancer reports (or `http` without one). scd-mock serves customer domains over plain HTTP, so `compose.yaml` sets `PROXY_PROTOCOL=http`. Leave it unset in production.

### Don't prerender publication pages

adapter-node serves prerendered pages as static files before `handle` runs, so a prerendered page would be the same on every domain. `(publication)/+layout.server.ts` sets `prerender = false` to make that explicit. If you turn it on, the build fails with ``Failed to prerender `/` `` (`404 GET /`), because at build time there's no customer domain.

## Run your own proxy instead (Caddy)

```bash
DOMAINS_PROVIDER=caddy docker compose --profile diy up --build
```

Add `acme.localhost` in the dashboard, click **Check DNS**, then:

```bash
curl -k https://acme.localhost/
```

Caddy asks `/api/caddy/ask` before issuing a certificate, and only active domains get one. Caddy passes the visitor's `Host` through and sets `X-Forwarded-Proto: https`, so SvelteKit sees the customer's domain without any extra step. Locally it uses Caddy's internal CA, hence `-k`. In production you'd remove `internal` from the `Caddyfile`, run it on a server with a static IP, and then own certificate storage, renewals, rate limits and monitoring yourself.

## Use it with your SaaS Custom Domains account

1. [Create an API token](https://app.saascustomdomains.com/api_tokens) and an upstream pointing at your deployed app.
2. Set the environment variables from `.env.example`: `SCD_API_TOKEN`, `SCD_ACCOUNT_UUID`, `SCD_UPSTREAM_UUID`, `PROXY_AUTH_TOKEN` (the upstream's auth token), `SCD_WEBHOOK_TOKEN` (from the webhook you create in the dashboard), and `APP_HOSTS`.
3. Remove `SCD_API_URL` so the client talks to the real API.

`APP_HOSTS` must list every hostname your own traffic arrives on: your app's domain, plus any internal name your platform uses to reach the app. `hooks.server.ts` treats any other host as a customer domain and returns 404 if it isn't connected. (In `compose.yaml` that's why `app` is listed: webhooks from the mock arrive as `Host: app:3000`.) The health check at `/api/up` skips the host check, because load balancers call it by IP address.

Your customers point a CNAME at `in.saascustomdomains.com` (or A records at our two static IPs for a root domain). When you add a domain with a DNS contact email, we email that person the exact records. See the [docs](https://docs.saascustomdomains.com).

## Tests

```bash
npm test                       # unit tests (hooks, proxy headers, hostnames, API client)
docker compose up -d --build --wait
npx playwright install chromium
npm run test:e2e               # end to end, through the mock proxy
```

The end-to-end tests use `*.test` domains and send the browser's requests for them to the mock proxy, so nothing depends on DNS or on port 80. They submit the subscribe form through the proxy with and without JavaScript, and post to a customer domain from another site to check that the CSRF check still refuses it. To run a second stack side by side, set `APP_PORT`, `SCD_MOCK_API_PORT` and `SCD_MOCK_PROXY_PORT` for both `docker compose` and `npm run test:e2e`.

CI runs both on every push and once a week, so a new SvelteKit release that breaks something shows up here first.

## Tested with

| | Version |
| --- | --- |
| SvelteKit | 3.1.0 |
| Svelte | 5.57.3 |
| @sveltejs/adapter-node | 6.0.0 |
| Vite | 8.3.5 |
| Node.js | 24 |

Last checked: 2026-10-28.

## Not production-ready on purpose

There's no login. In your app, check in every form action that the signed-in user owns the publication and the domain. SQLite (`node:sqlite`) keeps the example small; use your own database.

## License

MIT
