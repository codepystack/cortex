<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';

	let { children } = $props();

	const navItems = [
		{ href: '/chat', label: 'Chat', icon: '💬' },
		{ href: '/models', label: 'Models', icon: '🤖' },
		{ href: '/agents', label: 'Agents', icon: '🧠' },
		{ href: '/tools', label: 'Tools', icon: '🔧' },
		{ href: '/workflows', label: 'Workflows', icon: '⚡' },
		{ href: '/mcp', label: 'MCP', icon: '🔌' }
	];

	const authPages = ['/login', '/register', '/'];

	let token: string | null = $state(null);
	let userEmail: string | null = $state(null);

	auth.token.subscribe((v) => (token = v));
	auth.userEmail.subscribe((v) => (userEmail = v));

	function handleSignOut() {
		auth.clearAuth();
		goto('/login');
	}

	let isAuthPage = $derived(authPages.includes(page.url.pathname));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Cortex – AI Platform</title>
</svelte:head>

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="flex h-screen">
		<!-- Sidebar -->
		<aside class="flex w-64 flex-col border-r bg-card">
			<div class="p-6">
				<h1 class="text-xl font-bold tracking-tight">🧠 Cortex</h1>
				<p class="text-xs text-muted-foreground">AI Platform</p>
			</div>
			<Separator />
			<nav class="flex-1 space-y-1 p-3">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {page.url
							.pathname === item.href
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
					>
						<span>{item.icon}</span>
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>
			<Separator />
			<div class="p-4">
				{#if userEmail}
					<p class="mb-2 truncate text-xs text-muted-foreground">{userEmail}</p>
				{/if}
				<Button variant="outline" size="sm" class="w-full" onclick={handleSignOut}>
					Sign out
				</Button>
			</div>
		</aside>

		<!-- Main content -->
		<main class="flex-1 overflow-auto bg-background">
			{@render children()}
		</main>
	</div>
{/if}
