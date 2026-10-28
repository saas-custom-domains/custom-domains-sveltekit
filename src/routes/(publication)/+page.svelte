<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.publication.name}</title>
	<meta name="description" content={data.publication.tagline} />
</svelte:head>

<form method="POST" use:enhance class="subscribe">
	<input
		name="email"
		type="email"
		required
		placeholder="you@example.com"
		aria-label="Email"
		value={form?.email ?? ''}
	/>
	<button>Subscribe</button>
	{#if form?.message}
		<p role="status" class={form.email ? 'error' : 'ok'}>{form.message}</p>
	{/if}
</form>

<ul class="posts">
	{#each data.posts as post (post.slug)}
		<li>
			<a href={resolve('/(publication)/posts/[slug]', { slug: post.slug })}>{post.title}</a>
			<time datetime={post.published_on}>{post.published_on}</time>
		</li>
	{/each}
</ul>
