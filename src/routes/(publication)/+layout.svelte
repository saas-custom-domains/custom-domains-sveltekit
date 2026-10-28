<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<!-- An absolute URL: needs the customer's domain, not your app's. -->
	<link rel="canonical" href={page.url.origin + page.url.pathname} />
</svelte:head>

<main class="publication">
	<header>
		<a href={resolve('/(publication)')}><h1>{data.publication.name}</h1></a>
		<p class="muted">{data.publication.tagline}</p>
	</header>

	{@render children()}

	<footer class="muted">Served on {data.host}</footer>
</main>
