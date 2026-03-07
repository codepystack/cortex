<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { listTools, runTool } from '$lib/api';
	import type { Tool } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import * as Card from '$lib/components/ui/card';

	let token: string | null = $state(null);
	auth.token.subscribe((v) => (token = v));

	let tools: Tool[] = $state([]);
	let selected: Tool | null = $state(null);
	let argsJson = $state('{}');
	let output = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(async () => {
		try {
			tools = await listTools(token);
		} catch {
			error = 'Failed to load tools';
		}
	});

	function selectTool(tool: Tool) {
		selected = tool;
		argsJson = '{}';
		output = '';
		error = '';
	}

	async function handleRun() {
		if (!selected) return;
		error = '';
		output = '';
		loading = true;
		try {
			const args = JSON.parse(argsJson);
			const res = await runTool({ tool: selected.name, args }, token);
			output = typeof res.output === 'string' ? res.output : JSON.stringify(res.output, null, 2);
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to run tool';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex h-full">
	<!-- Tool list -->
	<div class="w-80 border-r">
		<div class="border-b p-4">
			<h2 class="text-lg font-semibold">Tools</h2>
			<p class="text-xs text-muted-foreground">{tools.length} available</p>
		</div>
		<ScrollArea class="h-[calc(100vh-8rem)]">
			<div class="space-y-1 p-2">
				{#each tools as tool}
					<button
						class="w-full rounded-lg p-3 text-left transition-colors {selected?.name === tool.name
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-accent'}"
						onclick={() => selectTool(tool)}
					>
						<p class="font-mono text-sm font-medium">{tool.name}</p>
						<div class="mt-1 flex items-center gap-2">
							<Badge variant="secondary" class="text-xs">{tool.source}</Badge>
						</div>
						<p class="mt-1 line-clamp-2 text-xs opacity-75">{tool.description}</p>
					</button>
				{/each}
			</div>
		</ScrollArea>
	</div>

	<!-- Tool runner -->
	<div class="flex-1 p-6">
		{#if selected}
			<Card.Root>
				<Card.Header>
					<Card.Title class="font-mono">{selected.name}</Card.Title>
					<Card.Description>{selected.description}</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-2">
						<Label for="args">Arguments (JSON)</Label>
						<Textarea id="args" rows={6} bind:value={argsJson} class="font-mono text-sm" />
					</div>
					<Button onclick={handleRun} disabled={loading}>
						{loading ? 'Running…' : 'Run Tool'}
					</Button>
					{#if error}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
					{/if}
					{#if output}
						<div class="space-y-2">
							<Label>Output</Label>
							<pre
								class="max-h-64 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">{output}</pre>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="flex h-full items-center justify-center text-muted-foreground">
				<p>Select a tool from the list to run it</p>
			</div>
		{/if}
	</div>
</div>
