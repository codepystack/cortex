<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { listMcpServers, listTools, registerMcpServer } from '$lib/api';
	import type { McpServer, Tool } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';

	let token: string | null = $state(null);
	auth.token.subscribe((v) => (token = v));

	let servers: McpServer[] = $state([]);
	let mcpTools: Tool[] = $state([]);

	let name = $state('');
	let url = $state('');
	let description = $state('');
	let toolsInput = $state('');
	let error = $state('');
	let success = $state('');
	let loading = $state(false);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		try {
			const [s, allTools] = await Promise.all([listMcpServers(token), listTools(token)]);
			servers = s;
			mcpTools = allTools.filter((t) => t.source.startsWith('mcp:'));
		} catch {
			error = 'Failed to load data';
		}
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		error = '';
		success = '';
		loading = true;
		try {
			const toolsList = toolsInput
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			await registerMcpServer({ name, url, description: description || undefined, tools: toolsList }, token);
			success = `MCP server "${name}" registered`;
			name = '';
			url = '';
			description = '';
			toolsInput = '';
			await loadData();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to register MCP server';
		} finally {
			loading = false;
		}
	}
</script>

<div class="p-6">
	<h2 class="mb-6 text-2xl font-bold">MCP Servers</h2>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Register form -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Register MCP Server</Card.Title>
				<Card.Description>Connect an external MCP server to Cortex</Card.Description>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleRegister} class="space-y-4">
					{#if error}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
					{/if}
					{#if success}
						<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
					{/if}
					<div class="space-y-2">
						<Label for="serverName">Server Name</Label>
						<Input id="serverName" required bind:value={name} />
					</div>
					<div class="space-y-2">
						<Label for="serverUrl">Server URL</Label>
						<Input id="serverUrl" required bind:value={url} placeholder="http://localhost:3001" />
					</div>
					<div class="space-y-2">
						<Label for="serverDesc">Description</Label>
						<Input id="serverDesc" bind:value={description} placeholder="Optional" />
					</div>
					<div class="space-y-2">
						<Label for="serverTools">Tools (comma-separated)</Label>
						<Input id="serverTools" bind:value={toolsInput} placeholder="tool1, tool2" />
					</div>
					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? 'Registering…' : 'Register Server'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- Servers & Tools -->
		<div class="space-y-6">
			<!-- Registered servers -->
			<div>
				<h3 class="mb-3 text-lg font-semibold">Registered Servers</h3>
				{#if servers.length === 0}
					<p class="text-sm text-muted-foreground">No MCP servers registered</p>
				{:else}
					<div class="space-y-3">
						{#each servers as server}
							<Card.Root>
								<Card.Content class="p-4">
									<div class="flex items-start justify-between">
										<div>
											<p class="font-medium">{server.name}</p>
											<p class="font-mono text-xs text-muted-foreground">{server.url}</p>
											{#if server.description}
												<p class="mt-1 text-sm text-muted-foreground">{server.description}</p>
											{/if}
										</div>
										<Badge variant="secondary">{server.tools.length} tools</Badge>
									</div>
									{#if server.tools.length > 0}
										<div class="mt-2 flex flex-wrap gap-1">
											{#each server.tools as tool}
												<Badge variant="outline" class="text-xs">{tool}</Badge>
											{/each}
										</div>
									{/if}
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</div>

			<Separator />

			<!-- MCP Tools -->
			<div>
				<h3 class="mb-3 text-lg font-semibold">MCP Tools</h3>
				{#if mcpTools.length === 0}
					<p class="text-sm text-muted-foreground">No MCP tools available</p>
				{:else}
					<div class="grid gap-3">
						{#each mcpTools as tool}
							<Card.Root>
								<Card.Content class="p-4">
									<p class="font-mono text-sm font-medium">{tool.name}</p>
									<Badge variant="secondary" class="mt-1 text-xs">{tool.source}</Badge>
									<p class="mt-1 text-xs text-muted-foreground">{tool.description}</p>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
